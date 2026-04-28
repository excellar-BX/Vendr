// search.controller.ts
import { FastifyRequest, FastifyReply } from 'fastify'
import * as SearchService from './search.service'
import { searchSchema, suggestionSchema, searchHistorySchema } from './search.schema'

export async function searchController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const parsed = searchSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        errors: parsed.error.flatten().fieldErrors,
      })
    }

    const input = parsed.data
    const result = await SearchService.searchVendorsAndProducts(input)

    return reply.status(200).send({
      success: true,
      data: {
        vendors: result.vendors,
        products: result.products,
        reels: result.reels,
        totalVendors: result.totalVendors,
        totalProducts: result.totalProducts,
        totalReels: result.totalReels,
        extractedTerm: result.extractedTerm,
      },
      query: input.q,
    })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({
      success: false,
      message: err.message,
    })
  }
}

export async function suggestionsController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const parsed = suggestionSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        errors: parsed.error.flatten().fieldErrors,
      })
    }

    const { q, limit } = parsed.data

    // userId is optional — if authenticated, pass it for personalised history suggestions
    const userId = (request as any).user?.id as string | undefined

    const suggestions = await SearchService.getSearchSuggestions({ q, limit, userId })

    return reply.status(200).send({
      success: true,
      data: suggestions,
    })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({
      success: false,
      message: err.message,
    })
  }
}

export async function searchHistoryController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request as any).user.id
    const history = await SearchService.getUserSearchHistory(userId)

    return reply.status(200).send({
      success: true,
      data: history,
    })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({
      success: false,
      message: err.message,
    })
  }
}

export async function saveSearchHistoryController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const parsed = searchHistorySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        errors: parsed.error.flatten().fieldErrors,
      })
    }

    const userId = (request as any).user.id
    await SearchService.saveSearchQuery(userId, parsed.data.query)

    return reply.status(200).send({
      success: true,
      message: 'Search saved',
    })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({
      success: false,
      message: err.message,
    })
  }
}

export async function clearSearchHistoryController(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request as any).user.id
    const { query } = request.query as { query?: string }
    await SearchService.clearSearchHistory(userId, query)

    return reply.status(200).send({
      success: true,
      message: query ? 'Search history item deleted' : 'Search history cleared',
    })
  } catch (err: any) {
    return reply.status(err.statusCode ?? 500).send({
      success: false,
      message: err.message,
    })
  }
}