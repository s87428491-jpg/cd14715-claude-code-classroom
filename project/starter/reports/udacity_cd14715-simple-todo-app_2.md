# 🔍 Code Review Report

## Summary

| Metric | Value |
|--------|-------|
| **Overall Score** | 15/100 |
| **Files Reviewed** | 1 |
| **Critical Issues** | 3 |
| **High Priority Tests** | 3 |
| **Refactoring Opportunities** | 6 |

## 🎯 Top Recommendations

1. 🚨 **Security**: SQL Injection Vulnerabilities: All three new functions (searchTodos, searchTodosByStatus, getTodosByUser) contain critical SQL injection vulnerabilities. User input is directly concatenated into SQL queries without parameterization. This allows attackers to execute arbitrary SQL commands, potentially leading to data theft, data manipulation, or complete database compromise. IMMEDIATE ACTION REQUIRED: Replace all string concatenation with parameterized queries using $1, $2 placeholders before merging.
   - Files: src/todo.ts

2. ⚠️ **Type Safety**: Type Inconsistency: The searchTodosByStatus function incorrectly uses string type for the completed parameter, which should be boolean to match the Todo interface. This type mismatch can lead to runtime errors and incorrect query results. Update the function signature to use boolean type.
   - Files: src/todo.ts

3. 🚨 **Testing**: Zero Test Coverage for New Functionality: All three new search functions have no test coverage whatsoever. Given the critical SQL injection vulnerabilities and security implications, comprehensive tests are essential before deployment. Required tests include: (1) SQL injection attack scenarios, (2) Valid input happy paths, (3) Edge cases (empty strings, special characters, non-existent records), (4) Invalid input handling.
   - Files: src/todo.ts, src/todo.test.ts

4. ⚠️ **Code Quality**: Missing Input Validation: None of the three new functions validate their input parameters. Empty strings, null values, excessively long inputs, or malformed data could cause unexpected behavior, performance issues, or security vulnerabilities. Add validation checks at function entry consistent with existing patterns (validateTodoInput, sanitizeInput).
   - Files: src/todo.ts

5. 📝 **Maintainability**: Inconsistency with Existing Code Patterns: The new functions violate established secure coding patterns in the codebase. Existing functions (createTodo, getTodoById, updateTodoStatus, deleteTodo) properly use parameterized queries, but the new functions do not. This inconsistency makes the codebase harder to maintain and increases the risk of future security issues. Refactor to match existing patterns.
   - Files: src/todo.ts

## 📁 File Details

### 📄 `src/todo.ts`

**Quality Score:** 15/100 | **Coverage:** ~15%

#### Issues (11)
  - Line 121: `critical` **security** SQL injection vulnerability: User-supplied keyword is directly interpolated into SQL query using template literals. An attacker could inject arbitrary SQL by providing input like "'; DROP TABLE todos; --" to execute malicious database operations.
    - Suggestion: Use parameterized queries with placeholders: const query = 'SELECT * FROM todos WHERE title LIKE $1 OR description LIKE $2'; const rows = await db.query(query, [`%${keyword}%`, `%${keyword}%`]);
  - Line 132: `critical` **security** SQL injection vulnerability: The completed parameter is concatenated directly into the SQL string without sanitization. An attacker could inject SQL by providing input like "1 OR 1=1" to bypass intended filtering or extract unauthorized data.
    - Suggestion: Use parameterized query: const sql = 'SELECT * FROM todos WHERE completed = $1'; const rows = await db.query(sql, [completed]);
  - Line 132: `high` **bug-risk** Type safety issue: The completed parameter is typed as string but should be boolean. This creates type inconsistency with the database schema and increases risk of incorrect queries (e.g., passing 'true' as string instead of boolean true).
    - Suggestion: Change parameter type to boolean: export async function searchTodosByStatus(completed: boolean): Promise<Todo[]> { ... }

  *...and 8 more*

#### Test Gaps (5)
  - `searchTodos function (lines 119-125)` (critical priority): This function uses LIKE queries with user input (keyword parameter) for SQL pattern matching. Without proper parameterization testing, it's vulnerable to SQL injection attacks. The sanitizeInput call provides some protection, but the actual SQL execution with wildcards (%keyword%) needs verification. Additionally, empty/null keyword handling and case-sensitivity behavior are untested.
    - Suggested test: Test 1 - SQL Injection Protection: Pass malicious input like "'; DROP TABLE todos; --" as keyword and verify it returns empty array without executing destructive SQL. Test 2 - Valid Search: Create todos with titles 'Buy groceries' and 'Buy tickets', search for 'Buy', assert both are returned. Test 3 - Case Insensitivity: Create todo with title 'URGENT Task', search for 'urgent', assert it's found. Test 4 - Empty Keyword: Pass empty string '', assert returns empty array or all todos (document expected behavior). Test 5 - No Matches: Search for 'nonexistentkeyword123', assert returns empty array. Test 6 - Description Search: Create todo with description containing keyword but not in title, verify it's found. Test 7 - Special Characters: Search for keywords with '%', '_', or other SQL wildcards, verify they're properly escaped.
  - `searchTodosByStatus function (lines 127-133)` (high priority): This function converts a string parameter ('true'/'false') to boolean for database querying. Multiple critical behaviors are untested: (1) String-to-boolean conversion logic, (2) Invalid status value handling (e.g., 'invalid', null, undefined), (3) Case sensitivity ('True' vs 'true'), (4) SQL injection through status parameter, and (5) Return value accuracy matching the completion status filter.
    - Suggested test: Test 1 - Completed Status: Create 3 completed todos (completed=true) and 2 incomplete, call searchTodosByStatus('true'), assert exactly 3 completed todos returned with correct IDs. Test 2 - Incomplete Status: Call searchTodosByStatus('false'), assert exactly 2 incomplete todos returned. Test 3 - Invalid Status Values: Test with 'invalid', '1', '0', 'yes', 'no', null, undefined, assert throws TypeError or returns empty array (document expected behavior). Test 4 - Case Variations: Test 'True', 'TRUE', 'False', 'FALSE', verify consistent handling. Test 5 - SQL Injection: Pass "true' OR '1'='1" as status, verify it doesn't bypass filtering. Test 6 - Empty Database: Call on empty database, assert returns empty array.

  *...and 3 more*

#### Refactoring Opportunities (6)
  - **modernize**: Replace string concatenation SQL injection vulnerability with parameterized query. This is critical for security and aligns with existing secure patterns in the codebase.
    - Before: `export async function searchTodos(keyword: string): Promise<Todo[]> {
  const query = `SELECT * FROM todos WHERE title LIKE '%${keyword}%' OR description LIKE '%${keyword}%'`;
  const rows = await db.query(query);
  return rows as Todo[];
}`
    - After: `export async function searchTodos(keyword: string): Promise<Todo[]> {
  const query = 'SELECT * FROM todos WHERE title LIKE $1 OR description LIKE $1';
  const searchPattern = `%${keyword}%`;
  const rows = await db.query(query, [searchPattern]);
  return rows as Todo[];
}`
    - Benefit: Prevents SQL injection attacks by using parameterized queries. Consistent with existing secure patterns (db.query with $1 placeholders). Maintains exact same search behavior with LIKE pattern matching. More maintainable and follows security best practices.
  - **modernize**: Fix type signature and SQL injection vulnerability. The completed parameter should be boolean (matching Todo type), and string concatenation must be replaced with parameterized query.
    - Before: `export async function searchTodosByStatus(completed: string): Promise<Todo[]> {
  const sql = "SELECT * FROM todos WHERE completed = " + completed;
  const rows = await db.query(sql);
  return rows as Todo[];
}`
    - After: `export async function searchTodosByStatus(completed: boolean): Promise<Todo[]> {
  const sql = 'SELECT * FROM todos WHERE completed = $1';
  const rows = await db.query(sql, [completed]);
  return rows as Todo[];
}`
    - Benefit: Corrects type from string to boolean, matching the Todo interface. Prevents SQL injection by using parameterized query. Consistent with existing secure database query patterns. Improves type safety and catches errors at compile time.

  *...and 4 more*

---

*Generated at 2026-11-03T05:28:08.180Z • Duration: 249498ms*
