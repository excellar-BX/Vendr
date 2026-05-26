import crypto from 'crypto'

/** Hours to hold escrow after buyer confirms pickup or vendor verifies OTP */
export const ESCROW_HOLD_HOURS = 2

/** Days before auto-release for pickup orders with no buyer confirmation */
export const PICKUP_AUTO_RELEASE_DAYS = 5

export function generateOtpCode(): string {
  return String(crypto.randomInt(1000, 10000))
}

export function escrowHoldReleaseAt(): Date {
  return new Date(Date.now() + ESCROW_HOLD_HOURS * 60 * 60 * 1000)
}

export function pickupFallbackReleaseAt(): Date {
  return new Date(Date.now() + PICKUP_AUTO_RELEASE_DAYS * 24 * 60 * 60 * 1000)
}
