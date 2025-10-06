import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../../prisma/prisma.service';
import * as fc from 'fast-check';

describe('UsersService (property tests)', () => {
  let service: UsersService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, PrismaService],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  beforeEach(async () => {
    // Clean DB before each test
    await prisma.user.deleteMany();
  });

  // Arbitrary generators for DTOs
  const emailArb = fc.uuid({ version: 4 }).map((id) => `${id}@example.com`);

  const createUserArb = fc.record({
    email: fc.noShrink(emailArb),
    firstName: fc.string({ minLength: 1, maxLength: 20 }),
    lastName: fc.string({ minLength: 1, maxLength: 20 }),
    password: fc.string({ minLength: 7, maxLength: 20 }),
  });

  const updateUserArb = fc.record({
    firstName: fc.string({ minLength: 1, maxLength: 20 }),
    lastName: fc.string({ minLength: 1, maxLength: 20 }),
    password: fc.string({ minLength: 7, maxLength: 20 }),
    isActive: fc.boolean(),
  });

  // 1. CREATE
  it('create should insert a new user and return it without password', async () => {
    await fc.assert(
      fc.asyncProperty(createUserArb, async (dto) => {
        const user = await service.create(dto);

        expect(user.id).toBeDefined();
        expect(user.email).toBe(dto.email);
        expect((user as any).password).toBeUndefined(); // password must not leak
      }),
    );
  });

  // 2. FIND ALL
  it('findAll should return all created users', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(createUserArb, { minLength: 1, maxLength: 5 }),
        async (users) => {
          await prisma.user.deleteMany();

          for (const u of users) {
            await service.create(u);
          }

          const result = await service.findAll();
          expect(result.length).toBe(users.length);
          const emails = result.map((u) => u.email);
          users.forEach((u) => expect(emails).toContain(u.email));
        },
      ),
    );
  });

  // 3. FIND ONE
  it('findOne should return the user after creation', async () => {
    await fc.assert(
      fc.asyncProperty(createUserArb, async (dto) => {
        const created = await service.create(dto);
        const found = await service.findOne(created.id);
        expect(found.email).toBe(dto.email);
      }),
    );
  });

  // 4. UPDATE
  it('update should preserve id and email while changing fields', async () => {
    await fc.assert(
      fc.asyncProperty(createUserArb, updateUserArb, async (dto, update) => {
        const created = await service.create(dto);
        const updated = await service.update(created.id, update);

        expect(updated.id).toBe(created.id);
        expect(updated.email).toBe(dto.email); // email not changed
        if (update.firstName) expect(updated.firstName).toBe(update.firstName);
      }),
    );
  });

  // 5. REMOVE
  it('remove should delete the user and make it unfindable', async () => {
    await fc.assert(
      fc.asyncProperty(createUserArb, async (dto) => {
        const created = await service.create(dto);
        const removed = await service.remove(created.id);
        expect(removed.id).toBe(created.id);

        await expect(service.findOne(created.id)).rejects.toThrow();
      }),
    );
  });

  // 6. DATA CONSISTENCY (Timestamps)
  it('created users should have proper timestamps and be consistent', async () => {
    await fc.assert(
      fc.asyncProperty(createUserArb, async (dto) => {
        await prisma.user.deleteMany();
        const beforeCreate = new Date();
        const user = await service.create(dto);
        const afterCreate = new Date();
        expect(user.createdAt).toBeDefined();
        expect(user.updatedAt).toBeDefined();
        const timeDiff = 1000;
        expect(user.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime() - timeDiff);
        expect(user.createdAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime() + timeDiff);
        expect(user.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime() - timeDiff);
        expect(user.updatedAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime() + timeDiff);
      }),
    );
  });
});
