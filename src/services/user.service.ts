import prisma from '../prisma';
import { hashPassword } from '../utils/hash';

export const getUsersByCompanyId = async (companyId: string, skip: number = 0, take: number = 10) => {
  return prisma.user.findMany({
    where: { companyId },
    skip,
    take,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
};

export const getUserByIdAndCompanyId = async (userId: string, companyId: string) => {
  const user = await prisma.user.findFirst({
    where: { id: userId, companyId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  if (!user) throw new Error('User not found in your company');
  return user;
};

export const createUser = async (companyId: string, data: any) => {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new Error('Email already in use');

  const hashedPassword = await hashPassword(data.password);

  return prisma.user.create({
    data: {
      companyId,
      name: data.name,
      email: data.email,
      password: hashedPassword,
      role: data.role,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
    },
  });
};

export const updateUser = async (userId: string, companyId: string, data: any) => {
  const user = await prisma.user.findFirst({ where: { id: userId, companyId } });
  if (!user) throw new Error('User not found in your company');

  if (data.email && data.email !== user.email) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new Error('Email already in use');
  }

  return prisma.user.update({
    where: { id: userId },
    data: {
      name: data.name !== undefined ? data.name : user.name,
      email: data.email !== undefined ? data.email : user.email,
      role: data.role !== undefined ? data.role : user.role,
      isActive: data.isActive !== undefined ? data.isActive : user.isActive,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
    },
  });
};

export const deleteUser = async (userId: string, companyId: string) => {
  const user = await prisma.user.findFirst({ where: { id: userId, companyId } });
  if (!user) throw new Error('User not found in your company');

  // Typically, we do soft deletes. But for complete clean up, we can delete.
  return prisma.user.delete({
    where: { id: userId },
  });
};
