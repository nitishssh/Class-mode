import { getTabsForRole } from '@/lib/role-navigation';
import { USER_ROLES } from '@/shared/authz';

// Tabs decide what each pilot user can even see; a wrong mapping either
// hides a workflow or exposes a staff surface to the wrong role.

describe('role navigation', () => {
  it('gives every role a tab set that starts with Home', () => {
    for (const role of USER_ROLES) {
      const tabs = getTabsForRole(role);
      expect(tabs.length).toBeGreaterThan(0);
      expect(tabs[0].route).toBe('index');
    }
  });

  it('maps every role to exactly its allowed screens', () => {
    // people is parent-only; school is staff-only; admin is fee/platform staff.
    const expected: Record<(typeof USER_ROLES)[number], string[]> = {
      student: ['index', 'lessons'],
      teacher: ['index', 'attendance'],
      parent: ['index', 'people'],
      principal: ['index', 'school'],
      school_admin: ['index', 'school', 'admin'],
      admin: ['index', 'admin'],
    };
    for (const role of USER_ROLES) {
      expect(getTabsForRole(role).map((t) => t.route)).toEqual(expected[role]);
    }
  });
});
