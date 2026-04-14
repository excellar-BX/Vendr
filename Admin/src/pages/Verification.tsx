import { useEffect, useState } from 'react'
import { getVerificationRequests, approveVerificationRequest, rejectVerificationRequest } from '../api'

interface VerificationRequest {
  id: string
  status: string
  tier: string
  submitted_at: string
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
  nin_number?: string
  cac_number?: string
}

export default function Verification() {
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
          submitted_at: new Date().toISOString(),
          vendor: {
            shop_name: 'Test Store',
            user: { full_name: 'John Doe', email: 'john@example.com' },
          },
          documents: {
            cac_certificate: 'url',
            nin_card: 'url',
            proof_of_address: 'url',
          },
          nin_number: '12345678901',
          cac_number: 'RC123456',
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
    return <div className="text-cream">Loading...</div>
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-cream mb-6">Vendor Verification</h1>
      <div className="bg-dark-2 border border-faint rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-dark-3">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase">Shop Name</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase">Owner</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase">NIN/CAC</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase">Status</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase">Submitted</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-faint">
            {requests.map((request) => (
              <tr key={request.id} className="hover:bg-dark-3">
                <td className="px-6 py-4 text-sm text-cream">{request.vendor.shop_name}</td>
                <td className="px-6 py-4">
                  <div>
                    <p className="text-sm text-cream">{request.vendor.user.full_name}</p>
                    <p className="text-xs text-muted">{request.vendor.user.email}</p>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-muted">
                  {request.nin_number && <div>NIN: {request.nin_number}</div>}
                  {request.cac_number && <div>CAC: {request.cac_number}</div>}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    request.status === 'pending' ? 'bg-gold text-dark' :
                    request.status === 'approved' ? 'bg-brand-green text-cream' :
                    'bg-brand-red text-cream'
                  }`}>
                    {request.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-muted">
                  {new Date(request.submitted_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    {request.documents.cac_certificate && (
                      <a
                        href={request.documents.cac_certificate}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-orange text-sm hover:underline"
                      >
                        View Docs
                      </a>
                    )}
                    {request.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleApproveRequest(request.id)}
                          className="bg-brand-green text-cream px-3 py-1 rounded text-xs hover:bg-brand-greenLight"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleRejectRequest(request.id)}
                          className="bg-brand-red text-cream px-3 py-1 rounded text-xs hover:bg-red-600"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
