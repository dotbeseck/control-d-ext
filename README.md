# Control D Quick Switcher

A browser extension for managing Control D rules for the current site with temporary overrides.

## Features

- **Quick Rule Management**: Easily block, bypass, or redirect domains directly from the browser
- **Temporary Overrides**: Set rules with customizable durations (1 minute to 24 hours, or permanent)
- **Proxy Redirection**: Redirect traffic through Control D proxy locations
- **Modern UI**: Clean, dark-themed interface with glassmorphism design
- **Real-time Status**: See the current domain status and rule state at a glance

## Installation

1. Clone this repository or download the extension files
2. Open your browser's extension management page:
   - Chrome/Edge: `chrome://extensions/`
   - Firefox: `about:addons`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the extension directory

## Configuration

1. Click the settings icon in the extension popup
2. Enter your Control D API Key
3. Enter your Profile ID (e.g., `p12345`)
4. Click "Save" for each field

## Usage

1. Navigate to any website
2. Click the extension icon in your browser toolbar
3. Select an action:
   - **Block**: Block the current domain
   - **Bypass**: Bypass filtering for the current domain
   - **Redirect**: Redirect traffic through a proxy location
4. Choose a duration (or select "Permanent")
5. Click "Apply Rule"

## Permissions

This extension requires the following permissions:
- `activeTab`: To access the current tab's URL
- `storage`: To save your API credentials and settings
- `alarms`: To manage temporary rule expiration
- `https://api.controld.com/*`: To communicate with the Control D API

## Development

### Project Structure

```
control-d-ext/
├── manifest.json      # Extension manifest (Manifest V3)
├── Interface.html     # Popup UI
├── logic.js           # Main extension logic
└── Worker.js          # Service worker for background tasks
```

### Technologies

- Manifest V3
- Vanilla JavaScript
- Modern CSS with glassmorphism design

## License

[Add your license here]

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

