# Griptape Nodes Desktop

A cross-platform desktop application for managing and developing AI workflows with the [Griptape](https://www.griptape.ai/) framework. This Electron-based application provides a local environment for creating, testing, and running Griptape Nodes workflows with the Griptape Nodes integrated visual editor.

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Electron](https://img.shields.io/badge/Electron-37.3.1-47848F?logo=electron)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19.1.1-61DAFB?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.2-3178C6?logo=typescript)](https://www.typescriptlang.org/)

## Overview

Griptape Nodes Desktop is a comprehensive desktop application that:

- **Manages the Griptape Nodes Engine**: Automatically installs, configures, and runs the Griptape Nodes backend engine
- **Provides Secure Authentication**: OAuth 2.0 integration with Griptape Cloud services
- **Offers Visual Workflow Development**: Embedded web-based visual workflow editor with drag-and-drop interface
- **Handles Environment Setup**: Automatically manages Python, UV package manager, and Griptape Nodes dependencies
- **Monitors Engine Status**: Real-time engine monitoring with detailed logging and status reporting
- **Auto-Update Support**: Velopack-powered automatic updates with multi-channel support

## Installation

### For End Users

Download the latest version for your platform from [griptapenodes.com](https://griptapenodes.com).

Available for macOS, Windows, and Linux.

### For Developers

For complete documentation, including architecture details, development guidelines, and troubleshooting, see [PROJECT-DOCS.md](PROJECT-DOCS.md).

## Quick Start (Development)

```bash
# Clone the repository
git clone https://github.com/griptape-ai/griptape-nodes-desktop.git
cd griptape-nodes-desktop

# Install dependencies
npm install

# Start development server
npm start
```

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

---

**Made with ❤️ by the Griptape team**

For more information, visit [griptape.ai](https://www.griptape.ai/)
