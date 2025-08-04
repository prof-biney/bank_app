# Contributing to BankApp

Thank you for your interest in contributing to BankApp! This document provides guidelines and instructions for contributing to this project.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. Please be respectful and considerate of others.

## How Can I Contribute?

### Reporting Bugs

This section guides you through submitting a bug report. Following these guidelines helps maintainers understand your report, reproduce the behavior, and find related reports.

Before creating bug reports, please check the issue tracker as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

* **Use a clear and descriptive title** for the issue to identify the problem.
* **Describe the exact steps which reproduce the problem** in as many details as possible.
* **Provide specific examples to demonstrate the steps**. Include links to files or GitHub projects, or copy/pasteable snippets, which you use in those examples.
* **Describe the behavior you observed after following the steps** and point out what exactly is the problem with that behavior.
* **Explain which behavior you expected to see instead and why.**
* **Include screenshots and animated GIFs** which show you following the described steps and clearly demonstrate the problem.
* **If the problem wasn't triggered by a specific action**, describe what you were doing before the problem happened.

### Suggesting Enhancements

This section guides you through submitting an enhancement suggestion, including completely new features and minor improvements to existing functionality.

* **Use a clear and descriptive title** for the issue to identify the suggestion.
* **Provide a step-by-step description of the suggested enhancement** in as many details as possible.
* **Provide specific examples to demonstrate the steps**. Include copy/pasteable snippets which you use in those examples.
* **Describe the current behavior** and **explain which behavior you expected to see instead** and why.
* **Include screenshots and animated GIFs** which help you demonstrate the steps or point out the part of the app which the suggestion is related to.
* **Explain why this enhancement would be useful** to most users.
* **List some other applications where this enhancement exists.**

### Pull Requests

* Fill in the required template
* Do not include issue numbers in the PR title
* Include screenshots and animated GIFs in your pull request whenever possible
* Follow the JavaScript/TypeScript styleguide
* Include adequate tests
* Document new code
* End all files with a newline

## Development Process

### Setting Up Development Environment

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/bank_app.git`
3. Add the original repository as upstream: `git remote add upstream https://github.com/ORIGINAL_OWNER/bank_app.git`
4. Install dependencies: `npm install` or `yarn install`
5. Start the development server: `npx expo start`

### Coding Style

* Use 2 spaces for indentation
* Use camelCase for variables and functions
* Use PascalCase for component names
* Use meaningful variable and function names
* Write comments for complex logic
* Follow the ESLint configuration

### Commit Messages

* Use the present tense ("Add feature" not "Added feature")
* Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
* Limit the first line to 72 characters or less
* Reference issues and pull requests liberally after the first line

### Branch Naming Convention

* Use `feature/` prefix for new features
* Use `bugfix/` prefix for bug fixes
* Use `docs/` prefix for documentation changes
* Use `refactor/` prefix for code refactoring
* Use `test/` prefix for adding or modifying tests

## Project Structure

```
bank_app/
├── app/                  # Main application screens and navigation
│   ├── (auth)/           # Authentication screens
│   ├── (tabs)/           # Main tab screens
│   └── _layout.tsx       # Root layout
├── assets/               # Static assets (images, fonts)
├── components/           # Reusable components
├── constants/            # Constants and types
├── context/              # React context providers
├── hooks/                # Custom React hooks
├── lib/                  # Utility functions and API clients
└── store/                # State management
```

## Testing

Before submitting a pull request, make sure your changes pass all tests:

```bash
npm test
# or
yarn test
```

## License

By contributing to BankApp, you agree that your contributions will be licensed under the project's MIT License.