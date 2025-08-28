# Unit Test Guide

## Overview

This directory contains comprehensive unit tests for the mygit implementation, including tests for all models and repositories.

## Test Structure

```
tests/unittest/
├── README.md           # This file
├── models/             # Tests for GitObject models
│   ├── types.test.ts   # Tests for type definitions
│   ├── blob.test.ts    # Tests for Blob class
│   ├── tree.test.ts    # Tests for Tree class
│   ├── commit.test.ts  # Tests for Commit class
│   └── gitObject.test.ts # Tests for GitObject base class
├── repositories/       # Tests for Repository classes
│   ├── objectRepository.test.ts # Tests for ObjectRepository class
│   ├── referenceRepository.test.ts # Tests for ReferenceRepository class
│   └── configRepository.test.ts # Tests for ConfigRepository class
└── utils/              # Tests for Utility functions
    └── gitUtils.test.ts # Tests for Git utility functions
```

## Running Tests

This project uses Node.js built-in test runner. No additional test framework installation is required.

### All Tests

```bash
npm test
```

### Watch Mode (re-run on file changes)

```bash
npm run test:watch
```

### Run Specific Test File

```bash
# Run ReferenceRepository tests
node --import tsx --test tests/unittest/repositories/referenceRepository.test.ts

# Run ConfigRepository tests
node --import tsx --test tests/unittest/repositories/configRepository.test.ts

# Run GitUtils tests
node --import tsx --test tests/unittest/utils/gitUtils.test.ts

# Run Blob tests
node --import tsx --test tests/unittest/models/blob.test.ts
```

### Run Tests with Pattern

```bash
# Find and run all test files
node --import tsx --test $(find . -name "*.test.ts")
```

## Expected Test Results

### Success Criteria

- All tests pass (✓ green status)
- No TypeScript compilation errors
- No linting violations

### Example Output

```
▶ ObjectRepository
  ▶ constructor
    ✓ should initialize with gitDir path
    ✓ should set objectsDir correctly
  ▶ write() method
    ✓ should write Blob object and return SHA
    ✓ should write Tree object correctly
    ...

✓ All tests passed
```
