// Redirect to membership page — passcode system replaced by membership
import { redirect } from 'next/navigation'

export default function UnlockPage({ params }: { params: { channelId: string } }) {
  redirect('/membership')
}
