---
title: "Rust-IoT-Platform"
source_url: "https://github.com/iot-ecology/rust-iot-platform"
retrieved_at: "2026-07-19T16:58:24Z"
source_snapshot: true
---

[Skip to content](#start-of-content)   



## Navigation Menu

[Sign in](/login?return_to=https%3A%2F%2Fgithub.com%2Fiot-ecology%2Frust-iot-platform) 

Appearance settings

# Search code, repositories, users, issues, pull requests...

[Search syntax tips](https://docs.github.com/search-github/github-code-search/understanding-github-code-search-syntax)

[Sign in](/login?return_to=https%3A%2F%2Fgithub.com%2Fiot-ecology%2Frust-iot-platform)

 [Sign up](/signup?ref_cta=Sign+up&ref_loc=header+logged+out&ref_page=%2F%3Cuser-name%3E%2F%3Crepo-name%3E&source=header-repo&source_repo=iot-ecology%2Frust-iot-platform) 

Appearance settings

You signed in with another tab or window. Reload to refresh your session. You signed out in another tab or window. Reload to refresh your session. You switched accounts on another tab or window. Reload to refresh your session. Dismiss alert

{{ message }}

### Uh oh!

There was an error while loading. Please reload this page.

[iot-ecology](/iot-ecology)   /  **[rust-iot-platform](/iot-ecology/rust-iot-platform)**  Public

* [Notifications](/login?return_to=%2Fiot-ecology%2Frust-iot-platform)  You must be signed in to change notification settings
* [Fork 21](/login?return_to=%2Fiot-ecology%2Frust-iot-platform)
* [Star  310](/login?return_to=%2Fiot-ecology%2Frust-iot-platform)

# iot-ecology/rust-iot-platform

[Branches](/iot-ecology/rust-iot-platform/branches)[Tags](/iot-ecology/rust-iot-platform/tags)

Open more actions menu

## Folders and files

| Name | Name | Last commit message | Last commit date |
| --- | --- | --- | --- |
| Latest commit   History[90 Commits](/iot-ecology/rust-iot-platform/commits/main/) 90 Commits |
| [.idea](/iot-ecology/rust-iot-platform/tree/main/.idea ".idea") | [.idea](/iot-ecology/rust-iot-platform/tree/main/.idea ".idea") |  |  |
| [.vscode](/iot-ecology/rust-iot-platform/tree/main/.vscode ".vscode") | [.vscode](/iot-ecology/rust-iot-platform/tree/main/.vscode ".vscode") |  |  |
| [api](/iot-ecology/rust-iot-platform/tree/main/api "api") | [api](/iot-ecology/rust-iot-platform/tree/main/api "api") |  |  |
| [common\_lib](/iot-ecology/rust-iot-platform/tree/main/common_lib "common_lib") | [common\_lib](/iot-ecology/rust-iot-platform/tree/main/common_lib "common_lib") |  |  |
| [data\_processing](/iot-ecology/rust-iot-platform/tree/main/data_processing "data_processing") | [data\_processing](/iot-ecology/rust-iot-platform/tree/main/data_processing "data_processing") |  |  |
| [iot\_protocol](/iot-ecology/rust-iot-platform/tree/main/iot_protocol "iot_protocol") | [iot\_protocol](/iot-ecology/rust-iot-platform/tree/main/iot_protocol "iot_protocol") |  |  |
| [notification](/iot-ecology/rust-iot-platform/tree/main/notification "notification") | [notification](/iot-ecology/rust-iot-platform/tree/main/notification "notification") |  |  |
| [prom](/iot-ecology/rust-iot-platform/tree/main/prom "prom") | [prom](/iot-ecology/rust-iot-platform/tree/main/prom "prom") |  |  |
| [readme](/iot-ecology/rust-iot-platform/tree/main/readme "readme") | [readme](/iot-ecology/rust-iot-platform/tree/main/readme "readme") |  |  |
| [.gitignore](/iot-ecology/rust-iot-platform/blob/main/.gitignore ".gitignore") | [.gitignore](/iot-ecology/rust-iot-platform/blob/main/.gitignore ".gitignore") |  |  |
| [LICENSE](/iot-ecology/rust-iot-platform/blob/main/LICENSE "LICENSE") | [LICENSE](/iot-ecology/rust-iot-platform/blob/main/LICENSE "LICENSE") |  |  |
| [feature.md](/iot-ecology/rust-iot-platform/blob/main/feature.md "feature.md") | [feature.md](/iot-ecology/rust-iot-platform/blob/main/feature.md "feature.md") |  |  |
| [feature\_CN.md](/iot-ecology/rust-iot-platform/blob/main/feature_CN.md "feature_CN.md") | [feature\_CN.md](/iot-ecology/rust-iot-platform/blob/main/feature_CN.md "feature_CN.md") |  |  |
| [nginx.conf](/iot-ecology/rust-iot-platform/blob/main/nginx.conf "nginx.conf") | [nginx.conf](/iot-ecology/rust-iot-platform/blob/main/nginx.conf "nginx.conf") |  |  |
| [readme.md](/iot-ecology/rust-iot-platform/blob/main/readme.md "readme.md") | [readme.md](/iot-ecology/rust-iot-platform/blob/main/readme.md "readme.md") |  |  |
| [readme\_CN.md](/iot-ecology/rust-iot-platform/blob/main/readme_CN.md "readme_CN.md") | [readme\_CN.md](/iot-ecology/rust-iot-platform/blob/main/readme_CN.md "readme_CN.md") |  |  |
| [work.sh](/iot-ecology/rust-iot-platform/blob/main/work.sh "work.sh") | [work.sh](/iot-ecology/rust-iot-platform/blob/main/work.sh "work.sh") |  |  |
|  |

## Repository files navigation

# Rust IoT Platform

This is a high-performance IoT development platform built with Rust, designed to support multiple protocols and provide real-time data processing capabilities. The platform supports MQTT, WebSocket (WS), TCP, and CoAP protocols, making it highly flexible for various IoT application scenarios.

## Key Features

* **High Performance**: Written in Rust, leveraging Rust's memory safety and concurrency features to deliver an efficient IoT solution.
* **Multi-Protocol Support**: Supports MQTT, WebSocket (WS), TCP, and CoAP protocols, catering to a wide range of application requirements.
* **Real-Time Data Processing**: Built-in real-time data processing mechanisms ensure fast response and efficient data transmission.
* **Modular Design**: Clearly defined modules for easy extension and maintenance.

feature list : [Feature](/iot-ecology/rust-iot-platform/blob/main/feature.md)

## Architecture Diagram

Below is the architecture diagram of the platform, illustrating how the various modules work together:

## Folder Structure

* **[common](/iot-ecology/rust-iot-platform/blob/main/common)**: Contains common utility modules for the platform, such as logging, configuration management, etc.
* **[data\_processing](/iot-ecology/rust-iot-platform/blob/main/data_processing)**: Modules for data processing, including data parsing, transformation, and other operations.
* **[iot\_protocol](/iot-ecology/rust-iot-platform/blob/main/iot_protocol)**: Modules for interfacing with various IoT protocols, including MQTT, WS, TCP, and CoAP.
* **[notification](/iot-ecology/rust-iot-platform/blob/main/notification)**: Modules for message notifications, supporting push notifications to devices or users.
* **[api](/iot-ecology/rust-iot-platform/blob/main/api)**: Modules providing external APIs for integrating the platform with other systems.

## Supported Protocols

* **MQTT**: Supports the standard MQTT protocol, ideal for real-time messaging applications.
* **WebSocket (WS)**: Provides real-time bidirectional communication support for web clients.
* **TCP**: A general-purpose transport protocol for device-to-device communication.
* **CoAP**: A protocol designed for low-power devices, suitable for embedded applications.

## Contributing

We welcome PRs to improve the project. Any suggestions or issues can be raised in the [Issues](https://github.com/iot-ecology/rust-iot-platform/issues) section.

[Apache 2.0 License](/iot-ecology/rust-iot-platform/blob/main/LICENSE)

## About

A high-performance IoT development platform built with Rust, designed for multi-protocol support and real-time data processing. This platform supports MQTT, WebSockets (WS), TCP, and CoAP protocols, making it highly flexible for diverse IoT applications.

### Resources

### License

[Apache-2.0 license](#Apache-2.0-1-ov-file)

### Uh oh!

There was an error while loading. Please reload this page.

[Custom properties](/iot-ecology/rust-iot-platform/custom-properties)

### Stars

**310** stars

### Watchers

**5** watching

### Forks

[**21** forks](/iot-ecology/rust-iot-platform/forks)

[Report repository](/contact/report-content?content_url=https%3A%2F%2Fgithub.com%2Fiot-ecology%2Frust-iot-platform&report=iot-ecology+%28user%29)

## [Releases](/iot-ecology/rust-iot-platform/releases)

No releases published

## [Packages 0](/orgs/iot-ecology/packages?repo_name=rust-iot-platform)

### Uh oh!

There was an error while loading. Please reload this page.

## [Contributors](/iot-ecology/rust-iot-platform/graphs/contributors)



### Uh oh!

There was an error while loading. Please reload this page.

## Languages

* [Rust 98.3%](/iot-ecology/rust-iot-platform/search?l=rust)
* [RenderScript 1.6%](/iot-ecology/rust-iot-platform/search?l=renderscript)
* [Shell 0.1%](/iot-ecology/rust-iot-platform/search?l=shell)

You can’t perform that action at this time.
