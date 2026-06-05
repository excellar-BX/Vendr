import type { FastifyRequest, FastifyReply } from 'fastify'
import { addToWaitlist, getWaitlistCount } from './waitlist.service'
import { z } from 'zod'

const waitlistSchema = z.object({
  name: z.string().optional(),
  email: z.string().email('Invalid email address'),
  type: z.string().optional(),
})

type WaitlistInput = z.infer<typeof waitlistSchema>

interface WaitlistServiceInput {
  name?: string;
  email: string;
  type?: string;
}

export async function joinWaitlist(request: FastifyRequest, reply: FastifyReply) {
  try {
    const data = waitlistSchema.parse(request.body) as WaitlistInput
    const serviceData: WaitlistServiceInput = {
      name: data.name,
      email: data.email,
      type: data.type,
    }
    const waitlist = await addToWaitlist(serviceData)
    return reply.status(201).send({
      success: true,
      message: 'Successfully joined waitlist',
      data: waitlist,
    })
  } catch (error: any) {
    if (error.statusCode === 409) {
      return reply.status(409).send({
        success: false,
        message: error.message,
      })
    }
    if (error instanceof z.ZodError) {
      return reply.status(400).send({
        success: false,
        message: error.errors[0].message,
      })
    }
    console.error('Waitlist error:', error)
    return reply.status(500).send({
      success: false,
      message: 'Something went wrong',
    })
  }
}

export async function getWaitlistStats(request: FastifyRequest, reply: FastifyReply) {
  try {
    const count = await getWaitlistCount()
    return reply.status(200).send({
      success: true,
      data: { count },
    })
  } catch (error: any) {
    console.error('Waitlist stats error:', error)
    return reply.status(500).send({
      success: false,
      message: 'Something went wrong',
    })
  }
}

export async function waitlistRoutes(fastify: any, options: any) {
  fastify.post('/waitlist', joinWaitlist)
  fastify.get('/waitlist/count', getWaitlistStats)
}
