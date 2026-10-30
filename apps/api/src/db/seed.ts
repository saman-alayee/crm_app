import bcrypt from 'bcryptjs';
import {
  ALL_PERMISSION_KEYS,
  DEFAULT_ACQUISITION_SOURCES,
  DEFAULT_PRODUCT_OPTIONS,
  PERMISSION_CATALOG,
  ROLE_DEFAULT_PERMISSIONS,
  SYSTEM_ROLES,
  permissionKey,
} from '../shared/index.js';
import { prisma } from './prisma.js';
import { config } from '../config/index.js';

async function seedPermissions() {
  for (const item of PERMISSION_CATALOG) {
    const key = permissionKey(item.module, item.action);
    await prisma.permission.upsert({
      where: { key },
      create: {
        key,
        module: item.module,
        action: item.action,
        description: item.description,
      },
      update: {
        description: item.description,
        module: item.module,
        action: item.action,
      },
    });
  }
}

async function syncRolePermissions(roleId: string, keys: readonly string[], byKey: Map<string, string>) {
  for (const key of keys) {
    const permissionId = byKey.get(key);
    if (!permissionId) continue;
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId, permissionId } },
      create: { roleId, permissionId },
      update: {},
    });
  }

  // For full-access / exact matrices: remove stale grants not in the target set
  const keep = new Set(keys);
  const current = await prisma.rolePermission.findMany({
    where: { roleId },
    include: { permission: { select: { key: true } } },
  });
  const stale = current.filter((rp) => !keep.has(rp.permission.key));
  for (const rp of stale) {
    await prisma.rolePermission.delete({
      where: { roleId_permissionId: { roleId: rp.roleId, permissionId: rp.permissionId } },
    });
  }
}

async function seedRoles() {
  const allPerms = await prisma.permission.findMany();
  const byKey = new Map(allPerms.map((p) => [p.key, p.id]));

  const roleIds: Record<string, string> = {};

  for (const def of Object.values(SYSTEM_ROLES)) {
    const role = await prisma.role.upsert({
      where: { slug: def.slug },
      create: {
        name: def.name,
        slug: def.slug,
        description: def.description,
        isSystem: true,
      },
      update: {
        name: def.name,
        description: def.description,
        isSystem: true,
      },
    });
    roleIds[def.slug] = role.id;

    const keys = ROLE_DEFAULT_PERMISSIONS[def.slug] || [];
    await syncRolePermissions(role.id, keys, byKey);
  }

  return {
    owner: { id: roleIds[SYSTEM_ROLES.OWNER.slug] },
    admin: { id: roleIds[SYSTEM_ROLES.ADMIN.slug] },
    employeeRole: { id: roleIds[SYSTEM_ROLES.EMPLOYEE.slug] },
  };
}

async function seedOwnerUser(ownerRoleId: string) {
  const passwordHash = await bcrypt.hash(config.seed.ownerPassword, 12);
  const username = config.seed.ownerUsername.trim().toLowerCase();
  const user = await prisma.user.upsert({
    where: { username },
    create: {
      username,
      email: config.seed.ownerEmail,
      passwordHash,
      isActive: true,
      employee: {
        create: {
          firstName: 'مدیر',
          lastName: 'سیستم',
          employeeCode: 'OWN-001',
        },
      },
    },
    update: {
      email: config.seed.ownerEmail,
      passwordHash,
      isActive: true,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: ownerRoleId } },
    create: { userId: user.id, roleId: ownerRoleId },
    update: {},
  });

  return user;
}

async function seedDepartments() {
  const defaults = [
    { name: 'منابع انسانی', description: 'جذب، نگهداشت و امور پرسنلی' },
    { name: 'مالی', description: 'حقوق، مساعده و حسابداری' },
    { name: 'فنی', description: 'توسعه و پشتیبانی فنی' },
    { name: 'عملیات', description: 'اجرا و هماهنگی روزانه' },
  ];
  for (const d of defaults) {
    await prisma.department.upsert({
      where: { name: d.name },
      create: d,
      update: { description: d.description },
    });
  }
}

async function seedThemeDefaults() {
  const defaults: Record<string, unknown> = {
    themePrimary: '#0b6e99',
    themeAccent: '#7ebfd6',
    darkModeDefault: false,
    companyName: 'فروشگاه سامی',
  };
  for (const [key, value] of Object.entries(defaults)) {
    await prisma.systemSetting.upsert({
      where: { key },
      create: { key, value: value as never },
      // Keep brand name + default blue theme in sync on every seed
      update:
        key === 'companyName' || key === 'themePrimary' || key === 'themeAccent'
          ? { value: value as never }
          : {},
    });
  }
}

async function seedShopDefaults() {
  for (const [i, name] of DEFAULT_ACQUISITION_SOURCES.entries()) {
    await prisma.acquisitionSource.upsert({
      where: { name },
      create: { name, sortOrder: i + 1, isActive: true },
      update: { sortOrder: i + 1 },
    });
  }
  for (const opt of DEFAULT_PRODUCT_OPTIONS) {
    await prisma.productOption.upsert({
      where: {
        kind_category_value: { kind: opt.kind, category: opt.category, value: opt.value },
      },
      create: opt,
      update: { sortOrder: opt.sortOrder, isActive: true },
    });
  }
}

async function main() {
  console.log('Seeding permissions & roles...');
  await seedPermissions();
  const { owner } = await seedRoles();
  const ownerUser = await seedOwnerUser(owner.id);
  await seedDepartments();
  await seedThemeDefaults();
  await seedShopDefaults();
  console.log(`Owner ready: ${ownerUser.username} (${ownerUser.id})`);
  console.log(`Permissions catalog: ${ALL_PERMISSION_KEYS.length}`);
  console.log('Seed complete.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
