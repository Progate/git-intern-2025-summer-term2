# Tests

This directory contains all test files for the mygit project, organized by test type and scope.

## Directory Structure

```
tests/
├── README.md                    # This file
├── e2e/                        # End-to-end tests
│   ├── README.md               # E2E test documentation
│   └── log.e2e.test.ts         # E2E tests for mygit log
├── integration/                # Integration tests
│   ├── README.md               # Integration test documentation
│   ├── repositories/           # Repository integration tests
│   └── utils/                  # Utility integration tests
└── unittest/                   # Unit tests
    ├── README.md               # Unit test documentation
    ├── commands/               # Command layer tests
    ├── models/                 # Model layer tests
    ├── repositories/           # Repository layer tests
    ├── services/               # Service layer tests (includes AddService)
    └── utils/                  # Utility function tests
```

## Test Types

### Unit Tests (`unittest/`)

- **Purpose**: Test individual functions, classes, and modules in isolation
- **Scope**: Single units of code with mocked dependencies
- **Location**: Mirror the `src/` directory structure
- **Example**: `tests/unittest/services/addService.test.ts`

### Integration Tests (`integration/`)

- **Purpose**: Test interactions between multiple components
- **Scope**: Real file system, actual Git operations, component integration
- **Location**: Organized by functional area
- **Example**: `tests/integration/repositories/objectRepository.integration.test.ts`

### End-to-End Tests (`e2e/`)

- **Purpose**: Test complete user workflows
- **Scope**: Full mygit command execution in real environments
- **Location**: Organized by command
- **Example**: `tests/e2e/log.e2e.test.ts`

### Manual Tests (`scripts/`)

- **Purpose**: Developer-friendly manual verification scripts
- **Scope**: Complete command testing with detailed output
- **Location**: `scripts/manual-test-*.mjs`
- **Example**: `scripts/manual-test-add.mjs`

## Running Tests

### All Tests

```bash
npm test                    # Run all automated tests
```

### By Type

```bash
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:e2e           # E2E tests only
```

### Specific Tests

```bash
# Run specific test file
node --import tsx --test tests/unittest/services/addService.test.ts

# Run tests matching pattern
npm test -- --grep "AddService"
```

### Manual Tests

```bash
npm run test:add:manual    # Manual test for mygit add command
```

## Test Coverage by Command

### mygit log

- ✅ Unit tests: `tests/unittest/services/logService.test.ts`
- ✅ Integration tests: Multiple repository integration tests
- ✅ E2E tests: `tests/e2e/log.e2e.test.ts`

### mygit add

- ✅ Unit tests: `tests/unittest/services/addService.test.ts`
- ✅ Manual tests: `scripts/manual-test-add.mjs` (recommended)
- ❌ E2E tests: Replaced with manual tests for simplicity

## Test Guidelines

### Unit Tests

- Use mocks for external dependencies
- Test edge cases and error conditions
- Keep tests fast and isolated
- Follow the AAA pattern (Arrange, Act, Assert)

### Integration Tests

- Use temporary directories for file operations
- Clean up resources in teardown
- Test real component interactions
- Verify actual Git operations

### E2E Tests

- Test complete user workflows
- Use real command-line execution
- Verify output and exit codes
- Handle environment setup/teardown

### Manual Tests

- Provide clear output and progress indication
- Include both success and failure scenarios
- Compare results with real Git when applicable
- Easy to run and understand for developers

## Adding New Tests

### For New Commands

1. Create unit tests in `tests/unittest/commands/`
2. Create service tests in `tests/unittest/services/`
3. Add integration tests if needed
4. Consider manual test script for complex commands
5. Add E2E tests for critical user workflows

### For New Components

1. Follow the directory structure mirroring `src/`
2. Start with unit tests
3. Add integration tests for file/system interactions
4. Update this README with new test coverage

## Test Dependencies

- **Node.js built-in test runner**: No additional framework needed
- **tsx**: TypeScript execution for test files
- **Temporary directories**: Tests create/cleanup temp files automatically
- **Real Git**: Integration and E2E tests may use actual Git commands for setup

## Troubleshooting

### Common Issues

- **File permissions**: Ensure test runner has write access to temp directories
- **Git configuration**: Some tests require Git user configuration
- **Path resolution**: Use absolute paths in file operations

### Debug Mode

```bash
# Run with verbose output
node --import tsx --test tests/path/to/test.ts --verbose

# Run single test case
# (Use test name filtering in the test file)
```
