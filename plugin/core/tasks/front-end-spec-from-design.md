# UX Task: Front-end Spec from Design

uses: [sequentialthinking, context7, figma]

Workflow
<!-- BMAD-style UX spec creation using AIgile template -->

# UX Task: Front-end Spec from Design

Create a developer-ready front-end specification from Figma designs.

## Inputs

```yaml
optional:
  - frameUrl: 'https://www.figma.com/file/xyz?node-id=123'
```

## Process (Sequential)

1. Extract Component Anatomy and States
	- Variants, states, interactions, tokens
2. Specify API
	- Props/slots/events; accessible names and roles
3. Layout and Responsiveness
	- Constraints, breakpoints, fluid/responsive behavior
4. Output Using Template
	- Use `core/templates/front-end-spec-tmpl.yaml` to structure content

## Outputs

- Front-end spec draft referencing the template
  - Links to Figma frames and exported assets (if any)
