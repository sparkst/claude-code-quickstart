# Project Name

## Mental Model
Brief description of what this system does and its primary purpose.

## Key Entry Points
- `src/auth/` - User authentication and authorization
- `src/api/` - HTTP API endpoints  
- `src/core/` - Business logic and domain models
- `src/ui/` - User interface components

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Development Setup
```bash
npm install
npm run dev
```

### Testing
```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

## Architecture Overview  

This project follows domain-driven design principles with clear separation of concerns. Each domain has its own directory with README.md explaining its purpose and boundaries.

For detailed implementation guidelines, see [CLAUDE.md](./CLAUDE.md).

## Project Structure

```
src/
├── README.md           # This file
├── CLAUDE.md           # Development guidelines  
├── auth/               # Authentication domain
├── api/                # HTTP API layer
├── core/               # Business logic
├── ui/                 # User interface
├── shared/             # Shared utilities
└── tests/              # Integration tests
```