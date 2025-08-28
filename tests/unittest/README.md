# Unit Test Guide

## Overview

This directory contains comprehensive unit tests for the mygit implementation, including tests for all models and repositories.

## Test Structure

```
tests/unittest/
├── README.md           # This file
├── commands/           # Tests for Command implementations
│   └── log.test.ts     # Tests for log command
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
├── services/           # Tests for Service classes
│   ├── addService.test.ts # Tests for AddService class
│   └── logService.test.ts # Tests for LogService class
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
# Run AddService tests
node --import tsx --test tests/unittest/services/addService.test.ts

# Run LogService tests  
node --import tsx --test tests/unittest/services/logService.test.ts

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
▶ AddService
  ▶ normalizePath
    ✓ should convert absolute path to relative path
    ✓ should keep relative path as is
    ✓ should handle nested paths correctly
  ▶ fileExists
    ✓ should return true for existing file
    ✓ should return false for non-existing file
    ✓ should return false for directory
  ▶ categorizeFiles
    ✓ should categorize untracked files correctly
    ✓ should throw error for non-existing files not in index
    ✓ should handle multiple files correctly

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

## Test Coverage

### Service Classes

- **AddService**: Tests file categorization, blob creation, and index updates
  - `normalizePath()`: Path normalization functionality  
  - `fileExists()`: File existence checking
  - `categorizeFiles()`: File categorization logic (tracking/untracked/deleted)
  - Integration with ObjectRepository and IndexRepository

- **LogService**: Tests commit history display functionality
  - Commit chain traversal
  - Error handling for missing commits
  - Output formatting

### Repository Classes

- **ObjectRepository**: Git object storage and retrieval
- **IndexRepository**: Git index file management  
- **ConfigRepository**: Git configuration parsing

### Model Classes

- **Blob**: Binary content storage
- **Tree**: Directory structure representation
- **Commit**: Commit object with metadata
- **GitObject**: Base class for all Git objects

### Utility Functions

- **GitUtils**: Git repository detection and navigation

## AddService Testing Details

The AddService tests use a sophisticated setup to test the complex file categorization logic:

### Test Setup

- Creates temporary directories to simulate Git repositories
- Generates proper Git index files using the Index class
- Uses mock logger to capture debug information
- Tests both existing and non-existing file scenarios

### Key Test Scenarios

1. **Path Normalization**: Converts absolute paths to relative paths correctly
2. **File Existence**: Properly detects files vs directories vs non-existing paths  
3. **File Categorization**: Correctly categorizes files as:
   - `tracking`: Files already in index that exist in working directory
   - `untracked`: Files not in index but exist in working directory
   - `deleted`: Files in index but don't exist in working directory

### Test Architecture

```typescript
describe('AddService', () => {
  // Setup temporary Git repository
  before(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'addservice-test-'));
    // Create .git structure and valid index file
  });

  // Test individual methods with private method access
  it('should convert absolute path to relative path', async () => {
    const service = await AddService.create(tempDir, mockLogger);
    const normalizePathMethod = (service as any).normalizePath.bind(service);
    // Test implementation
  });
});
```

The tests ensure AddService correctly handles the core `mygit add` functionality including blob creation and index updates.
