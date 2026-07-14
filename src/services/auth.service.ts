import prisma from '../prisma';
import { hashPassword, comparePassword } from '../utils/hash';
import { generateTokens, verifyRefreshToken } from '../utils/jwt';

export const registerCompanyAndOwner = async (data: any) => {
  const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
  if (existingUser) {
    throw new Error('Email is already registered');
  }

  const hashedPassword = await hashPassword(data.password);

  const result = await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        name: data.companyName,
        email: data.email,
      },
    });

    const user = await tx.user.create({
      data: {
        companyId: company.id,
        name: data.name,
        email: data.email,
        password: hashedPassword,
        role: 'COMPANY_OWNER',
      },
    });

    return { company, user };
  });

  const tokens = generateTokens(result.user.id, result.user.role, result.company.id);

  return {
    user: { id: result.user.id, name: result.user.name, email: result.user.email, role: result.user.role },
    company: { id: result.company.id, name: result.company.name },
    tokens,
  };
};

export const loginUser = async (data: any) => {
  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user || !user.isActive) {
    throw new Error('Invalid credentials or inactive account');
  }

  const isValidPassword = await comparePassword(data.password, user.password);
  if (!isValidPassword) {
    throw new Error('Invalid credentials');
  }

  const tokens = generateTokens(user.id, user.role, user.companyId);

  return {
    user: { id: user.id, name: user.name, email: user.email, role: user.role, companyId: user.companyId },
    tokens,
  };
};

export const refreshToken = async (token: string) => {
  const decoded: any = verifyRefreshToken(token);
  if (!decoded) {
    throw new Error('Invalid refresh token');
  }

  const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
  if (!user || !user.isActive) {
    throw new Error('User not found or inactive');
  }

  return generateTokens(user.id, user.role, user.companyId);
};
