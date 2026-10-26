$ErrorActionPreference = 'Stop'
try {
    $request = [Console]::In.ReadToEnd() | ConvertFrom-Json
    $typeSource = @'
using System;
using System.IO;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Security.Cryptography;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;
public static class WorkflowFile {
    [StructLayout(LayoutKind.Sequential)]
    public struct FileInfo {
        public uint Attributes;
        public System.Runtime.InteropServices.ComTypes.FILETIME Created, Accessed, Written;
        public uint Volume, SizeHigh, SizeLow, Links, IndexHigh, IndexLow;
    }
    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool GetFileInformationByHandle(SafeFileHandle handle, out FileInfo information);
    public static string Identity(FileStream stream) {
        FileInfo info;
        if (!GetFileInformationByHandle(stream.SafeFileHandle, out info) || info.Links != 1)
            throw new IOException("Cannot preserve workflow file identity or multiple hard links");
        return info.Volume + ":" + info.IndexHigh + ":" + info.IndexLow;
    }
    public static void CheckPath(string filename) {
        string full = Path.GetFullPath(filename);
        var drive = new DriveInfo(Path.GetPathRoot(full));
        if (drive.DriveType != DriveType.Fixed || drive.DriveFormat != "NTFS")
            throw new IOException("Workflow secure persistence requires a local NTFS volume on Windows");
        for (string part = full; part != null; part = Path.GetDirectoryName(part)) {
            if (File.Exists(part) || Directory.Exists(part)) {
                if ((File.GetAttributes(part) & (FileAttributes.ReparsePoint | FileAttributes.Encrypted)) != 0)
                    throw new IOException("Refusing workflow reparse point or encrypted path");
            }
        }
    }
    public static FileSecurity Security(string filename) {
        return File.GetAccessControl(filename, AccessControlSections.Access | AccessControlSections.Owner | AccessControlSections.Group);
    }
    public static string Descriptor(FileSecurity security) {
        return security.GetSecurityDescriptorSddlForm(AccessControlSections.Access | AccessControlSections.Owner | AccessControlSections.Group);
    }
    public static FileSecurity PrivateSecurity() {
        var owner = WindowsIdentity.GetCurrent().User;
        var security = new FileSecurity();
        security.SetOwner(owner);
        security.SetAccessRuleProtection(true, false);
        security.AddAccessRule(new FileSystemAccessRule(owner, FileSystemRights.FullControl, AccessControlType.Allow));
        return security;
    }
    public static FileStream Create(string filename, FileSecurity security) {
        return new FileStream(filename, FileMode.CreateNew, FileSystemRights.FullControl,
            FileShare.None, 4096, FileOptions.WriteThrough, security);
    }
    public static FileStream Open(string filename) {
        return new FileStream(filename, FileMode.Open, FileAccess.Read, FileShare.Read | FileShare.Delete);
    }
    public static void Replace(string temporary, string filename) {
        File.Replace(temporary, filename, null, false);
    }
    public static void Preflight(string filename, FileSecurity security, string expected) {
        string source = filename + "." + Guid.NewGuid().ToString("N") + ".tmp";
        string destination = filename + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try {
            foreach (string candidate in new [] { source, destination }) {
                using (var stream = Create(candidate, security)) {
                    if (Descriptor(Security(candidate)) != expected) {
                        var exact = new FileSecurity();
                        exact.SetSecurityDescriptorSddlForm(expected, AccessControlSections.Access | AccessControlSections.Owner | AccessControlSections.Group);
                        stream.SetAccessControl(exact);
                    }
                    if (Descriptor(Security(candidate)) != expected) throw new IOException("Cannot stage exact workflow security; original unchanged");
                    stream.Flush(true);
                }
            }
            Replace(source, destination);
            if (Descriptor(Security(destination)) != expected)
                throw new IOException("NTFS cannot preserve this exact descriptor through replacement; original unchanged. Owner must review its inheritance settings.");
        } finally {
            if (File.Exists(source)) File.Delete(source);
            if (File.Exists(destination)) File.Delete(destination);
        }
    }
    public static string Digest(FileStream stream) {
        stream.Position = 0;
        using (var algorithm = SHA256.Create()) {
            return BitConverter.ToString(algorithm.ComputeHash(stream)).Replace("-", "").ToLowerInvariant();
        }
    }
}
'@
    if (-not ('WorkflowFile' -as [type])) {
        $hashBytes = [System.Security.Cryptography.SHA256]::Create().ComputeHash([System.Text.Encoding]::UTF8.GetBytes($typeSource))
        $hashHex = [BitConverter]::ToString($hashBytes).Replace('-', '').Substring(0, 16).ToLowerInvariant()
        $cachedDll = [IO.Path]::Combine([IO.Path]::GetTempPath(), "aigile-workflow-file-$hashHex.dll")
        if ([IO.File]::Exists($cachedDll)) {
            try { Add-Type -Path $cachedDll } catch {}
        }
        if (-not ('WorkflowFile' -as [type])) {
            $tempDll = "$cachedDll.$([Guid]::NewGuid().ToString('N')).tmp.dll"
            try {
                Add-Type -TypeDefinition $typeSource -OutputAssembly $tempDll
                if (-not [IO.File]::Exists($cachedDll)) {
                    try { [IO.File]::Move($tempDll, $cachedDll) } catch {}
                }
                if ([IO.File]::Exists($cachedDll)) { Add-Type -Path $cachedDll }
            } catch {}
            finally {
                if ([IO.File]::Exists($tempDll)) { try { [IO.File]::Delete($tempDll) } catch {} }
            }
            if (-not ('WorkflowFile' -as [type])) {
                Add-Type -TypeDefinition $typeSource
            }
        }
    }
    $filename = [string]$request.filename
    [WorkflowFile]::CheckPath($filename)
    if ($request.operation -eq 'lock') {
        $lock = $filename + '.lock'
        if ([IO.File]::Exists($lock)) { throw 'EEXIST: workflow lock already exists' }
        $stream = [WorkflowFile]::Create($lock, [WorkflowFile]::PrivateSecurity())
        try {
            try { $stream.Flush($true) } finally { $stream.Dispose() }
            $original = [WorkflowFile]::Open($filename)
            try {
                $security = [WorkflowFile]::Security($filename)
                [ordered]@{ identity = [WorkflowFile]::Identity($original); sddl = [WorkflowFile]::Descriptor($security); sha256 = [WorkflowFile]::Digest($original) } | ConvertTo-Json -Compress
            } finally { $original.Dispose() }
        } catch { [IO.File]::Delete($lock); throw }
    } elseif ($request.operation -eq 'write') {
        $temporary = $filename + '.' + [Guid]::NewGuid().ToString('N') + '.tmp'
        $original = $null
        $staging = $null
        try {
            $security = [WorkflowFile]::PrivateSecurity()
            if ($request.replace) {
                $original = [WorkflowFile]::Open($filename)
                $security = [WorkflowFile]::Security($filename)
                if ([WorkflowFile]::Identity($original) -cne $request.expected.identity -or [WorkflowFile]::Descriptor($security) -cne $request.expected.sddl -or [WorkflowFile]::Digest($original) -cne $request.expected.sha256) { throw 'Workflow file identity, security or bytes changed under lock' }
                [WorkflowFile]::Preflight($filename, $security, $request.expected.sddl)
            } elseif ([IO.File]::Exists($filename)) { throw 'EEXIST: workflow file already exists' }
            $staging = [WorkflowFile]::Create($temporary, $security)
            if (!$request.replace) { $staging.SetAccessControl($security) }
            if ($request.replace -and [WorkflowFile]::Descriptor([WorkflowFile]::Security($temporary)) -cne $request.expected.sddl) {
                $exact = [Security.AccessControl.FileSecurity]::new()
                $exact.SetSecurityDescriptorSddlForm($request.expected.sddl, [Security.AccessControl.AccessControlSections]'Access,Owner,Group')
                $staging.SetAccessControl($exact)
            }
            if ($request.replace -and [WorkflowFile]::Descriptor([WorkflowFile]::Security($temporary)) -cne $request.expected.sddl) { throw 'Cannot preserve exact owner/group/DACL and inheritance before writing; original unchanged' }
            $stagingIdentity = [WorkflowFile]::Identity($staging)
            $data = [Convert]::FromBase64String($request.bytes)
            $staging.Write($data, 0, $data.Length)
            $staging.Flush($true)
            $staging.Dispose()
            $staging = $null
            [WorkflowFile]::CheckPath($filename)
            [WorkflowFile]::CheckPath($temporary)
            $check = [WorkflowFile]::Open($temporary)
            try { if ([WorkflowFile]::Identity($check) -cne $stagingIdentity) { throw 'Staging identity changed' } } finally { $check.Dispose() }
            if ($request.replace) {
                $check = [WorkflowFile]::Open($filename)
                try {
                    if ([WorkflowFile]::Identity($check) -cne $request.expected.identity -or [WorkflowFile]::Digest($check) -cne $request.expected.sha256 -or [WorkflowFile]::Descriptor([WorkflowFile]::Security($filename)) -cne $request.expected.sddl -or [WorkflowFile]::Descriptor([WorkflowFile]::Security($temporary)) -cne $request.expected.sddl) { throw 'Workflow identity/security changed before commit' }
                } finally { $check.Dispose() }
                [WorkflowFile]::Replace($temporary, $filename)
                if ([WorkflowFile]::Descriptor([WorkflowFile]::Security($filename)) -cne $request.expected.sddl) { throw 'Filesystem did not preserve security at commit; stop and inspect state' }
            } else { [IO.File]::Move($temporary, $filename) }
            $check = [WorkflowFile]::Open($filename)
            try { if ([WorkflowFile]::Identity($check) -cne $stagingIdentity) { throw 'Committed workflow identity mismatch' } } finally { $check.Dispose() }
            [Console]::Out.WriteLine('{}')
        } finally {
            if ($null -ne $staging) { $staging.Dispose() }
            if ($null -ne $original) { $original.Dispose() }
            if ([IO.File]::Exists($temporary)) { [IO.File]::Delete($temporary) }
        }
    } else { throw 'Unsupported workflow file helper operation' }
} catch {
    [Console]::Error.WriteLine('Workflow security helper: ' + $_.Exception.Message)
    exit 1
}