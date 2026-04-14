import { useEffect, useState } from 'react'
import { getVerificationRequests, approveVerificationRequest, rejectVerificationRequest } from '../api'

interface VerificationRequest {
  id: string
  status: string
  tier: string
  created_at: string
  vendor: {
    shop_name: string
    user: {
      full_name: string
      email: string
    }
  }
  documents: {
    cac_certificate?: string
    nin_card?: string
    proof_of_address?: string
  }
}

export default function VerificationRequests() {
  const [requests, setRequests] = useState<VerificationRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRequests()
  }, [])

  const fetchRequests = async () => {
    try {
      const data = await getVerificationRequests()
      setRequests(data)
    } catch (error) {
      console.error('Error fetching verification requests:', error)
      // Mock data for now
      setRequests([
        {
          id: '1',
          status: 'pending',
          tier: 'basic',
          created_at: new Date().toISOString(),
          vendor: {
            shop_name: 'Test Store',
            user: { full_name: 'John Doe', email: 'john@example.com' },
          },
          documents: {
            cac_certificate: 'url',
            nin_card: 'url',
            proof_of_address: 'url',
          },
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleApproveRequest = async (requestId: string) => {
    try {
      await approveVerificationRequest(requestId)
      fetchRequests()
    } catch (error) {
      console.error('Error approving request:', error)
    }
  }

  const handleRejectRequest = async (requestId: string) => {
    try {
      await rejectVerificationRequest(requestId)
      fetchRequests()
    } catch (error) {
      console.error('Error rejecting request:', error)
    }
  }

  if (loading) {
    return <div className="text-white">Loading...</div>
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Verification Requests</h1>
      <div className="space-y-4">
        {requests.map((request) => (
          <div key={request.id} className="bg-gray-800 rounded-xl p-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">{request.vendor.shop_name}</h3>
                <p className="text-sm text-gray-400 mt-1">{request.vendor.user.full_name}</p>
                <p className="text-sm text-gray-400">{request.vendor.user.email}</p>
                <p className="text-sm text-gray-400">Tier: {request.tier}</p>
                <p className="text-sm text-gray-400">Date: {new Date(request.created_at).toLocaleDateString()}</p>
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium text-white">Documents:</p>
                  {request.documents.cac_certificate && (
                    <a
                      href={request.documents.cac_certificate}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 text-sm hover:underline"
                    >
                      CAC Certificate
                    </a>
                  )}
                  {request.documents.nin_card && (
                    <a
                      href={request.documents.nin_card}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 text-sm hover:underline"
                    >
                      NIN Card
                    </a>
                  )}
                  {request.documents.proof_of_address && (
                    <a
                      href={request.documents.proof_of_address}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 text-sm hover:underline"
                    >
                      Proof of Address
                    </a>
                  )}
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs ${
                request.status === 'pending' ? 'bg-yellow-500 text-white' :
                request.status === 'approved' ? 'bg-green-500 text-white' :
                'bg-red-500 text-white'
              }`}>
                {request.status}
              </span>
            </div>
            {request.status === 'pending' && (
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => handleApproveRequest(request.id)}
                  className="bg-green-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-600"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleRejectRequest(request.id)}
                  className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-600"
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
