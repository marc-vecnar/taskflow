# Documentation

## Trigger
When writing or modifying source files.

## Instructions
- Add JSDoc to all exported functions and classes
- Required tags: @param (with type), @returns, @throws (if applicable)
- Add @example for any function with non-obvious usage
- Skip documentation for:
  - Private helper functions under 12 lines
  - Obvious getters/setters
  - Test files
- README updates: if a new feature changes the public API, add it to the relevant section in the README.md
- Inline commenst: only when the WHY is non-obvious. 
  Never comment on WHAT the code does.

  ## Example
  Bad:
    /* Gets the User */
    export function getUser(id: string) : User

  Good: 
   /**
     * Fetches a uer profile from the cache, falling back to
     * the database if the cache entry is stale (> 5 min).
     * @param id - UUID of the user
     * @returns The user profile, or null if not found
     * throws() (DatabaseError) if the connection pool is exhousted
     * @example  
     * const user = await getUser('a1b2c3')
     * if (!user) redirect('/login')
   */

   export async function getUser(id: string): Promise<User | null>