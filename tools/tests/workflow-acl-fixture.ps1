$ErrorActionPreference = 'Stop'
$request = [Console]::In.ReadToEnd() | ConvertFrom-Json
$sections = [Security.AccessControl.AccessControlSections]'Access,Owner,Group'
$acl = [IO.File]::GetAccessControl($request.path, $sections)
if ($request.protect) {
    $owner = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $acl.SetOwner($owner)
    $acl.SetAccessRuleProtection($true, $false)
    foreach ($rule in @($acl.Access)) { [void]$acl.RemoveAccessRuleSpecific($rule) }
    $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($owner, 'FullControl', 'Allow'))
    [IO.File]::SetAccessControl($request.path, $acl)
    $acl = [IO.File]::GetAccessControl($request.path, $sections)
} elseif ($request.inherit) {
    $acl.SetAccessRuleProtection($false, $true)
    [IO.File]::SetAccessControl($request.path, $acl)
    $acl = [IO.File]::GetAccessControl($request.path, $sections)
}
[ordered]@{ owner = $acl.Owner; sddl = $acl.Sddl; protected = $acl.AreAccessRulesProtected } | ConvertTo-Json -Compress