## ADDED Requirements

### Requirement: Chat input receives focus when panel opens

The system SHALL automatically set focus to the chat input textarea when the chat panel becomes visible.

#### Scenario: Opening chat panel via sidebar button click
- **WHEN** user clicks the chat icon in the right sidebar
- **THEN** the chat panel opens AND the chat input textarea receives focus

#### Scenario: Opening chat panel via keyboard shortcut
- **WHEN** user presses `Ctrl+I` (or `Cmd+I` on macOS)
- **THEN** the chat panel opens AND the chat input textarea receives focus

#### Scenario: Switching to chat tab from another tab
- **WHEN** user clicks the chat icon while another sidebar tab is open
- **THEN** the sidebar switches to the chat panel AND the chat input textarea receives focus

#### Scenario: Chat input is disabled during streaming
- **WHEN** the chat panel opens while a response is being streamed
- **THEN** the chat input textarea SHALL NOT receive focus (as it is disabled)

#### Scenario: Chat input is disabled when Claude CLI unavailable
- **WHEN** the chat panel opens and Claude CLI is not installed or unavailable
- **THEN** the chat input textarea SHALL NOT receive focus (as it is disabled)
