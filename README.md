# Greenhouse Monitoring Project

## Overview

A greenhouse-related project repository containing a web interface, source code, SQL resources, and an HTML subproject. The repository is intended to support learning and development around monitoring a greenhouse environment.

## Mission

Explore how connected sensors and a simple software interface can help monitor greenhouse conditions and support informed environmental control.

## Goals

- Organize the project code, web interface, and database resources clearly.
- Present greenhouse readings in a way that is easy to understand.
- Support sensor/device data integration as implemented by the firmware and backend.
- Keep environmental-control behavior understandable and testable.
- Document the hardware, pin connections, and configuration when they are finalized.

## Repository structure

- `greenhouse/` — main project source and web assets
- `in_html/` — HTML interface materials
- `sql/` — database scripts

## Getting started

Review the package configuration inside `greenhouse/` and follow its scripts for the web portion. Import SQL resources only into a development database. Hardware and sensor configuration should be documented alongside the corresponding firmware before connecting physical equipment.

## Development priorities

Distinguish live sensor readings from test data, handle missing or disconnected sensors safely, and keep device credentials private.
