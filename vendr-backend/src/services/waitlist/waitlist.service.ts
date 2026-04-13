import prisma from '../../lib/prisma'

export async function addToWaitlist(data: { name?: string; email: string; type?: string }) {
  try {
    const waitlist = await prisma.waitlist.create({
      data: {
        name: data.name || null,
        email: data.email,
        type: data.type || null,
      },
    })
    return waitlist
  } catch (error: any) {
    // Check if it's a unique constraint violation (email already exists)
    if (error.code === 'P2002') {
      throw { statusCode: 409, message: 'Email already on waitlist' }
    }
    throw error
  }
}

export async function getWaitlistCount() {
  const count = await prisma.waitlist.count()
  return count
}
