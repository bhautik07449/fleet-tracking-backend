import prisma from '../prisma';

export const getCompanyById = async (companyId: string) => {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      subscriptions: true,
      _count: {
        select: { vehicles: true, drivers: true, users: true },
      },
    },
  });

  if (!company) {
    throw new Error('Company not found');
  }

  return company;
};

export const updateCompany = async (companyId: string, data: any) => {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) {
    throw new Error('Company not found');
  }

  return prisma.company.update({
    where: { id: companyId },
    data: {
      name: data.name !== undefined ? data.name : company.name,
      address: data.address !== undefined ? data.address : company.address,
      phone: data.phone !== undefined ? data.phone : company.phone,
      settings: data.settings !== undefined ? data.settings : company.settings,
    },
  });
};
