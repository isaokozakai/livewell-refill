// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'
import fs from 'fs'
import path from 'path'

// Use separate test database to avoid polluting real data
process.env.DATA_DIR = './data/test';

// Clean up test database before all tests
beforeAll(() => {
  const testDbPath = path.join(process.cwd(), 'data/test/db.json');
  const testDir = path.dirname(testDbPath);

  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
});
