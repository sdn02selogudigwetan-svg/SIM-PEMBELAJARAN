# Firebase Security Specification

## Data Invariants
1. A profile (`users/{userId}`) can only be created by the authenticated user with the matching UID.
2. Only admins or the owner can update a user profile.
3. Classes, Subjects, and Schedules are manageable by teachers and admins.
4. Attendance and Grades are manageable by teachers (for their classes) and admins.
5. Teaching Documents are manageable by the teacher who created them or admins.
6. Identity roles are strictly controlled; users cannot set themselves as 'admin' unless they are already in the `admins` collection.

## The "Dirty Dozen" Payloads (Deny Cases)
1. Create a user profile with `role: 'admin'` as a non-admin.
2. Update another user's `full_name`.
3. Create a teaching document with `teacher_id` not matching the current user's UID.
4. Delete a class as a student.
5. Update `created_at` timestamp on any document.
6. List all `attendance` records without being a teacher or admin.
7. Inject a 2MB string into `notes` in attendance.
8. Create a grade with a score > 100 if the app limits it (let's assume max 1000 for safety against exhaustion).
9. Update `academic_year` on a grade document if it's considered immutable.
10. Anonymous user attempting any write.
11. User with unverified email attempting sensitive writes.
12. Updating `id` field in any document (if explicitly in data).

## Test Runner (Draft)
A `firestore.rules.test.ts` will be implemented to verify these constraints.
