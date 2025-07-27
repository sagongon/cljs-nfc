// app/(main)/create-group/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { toast } from 'sonner'

interface Group {
  name: string
  members: string[]
  description: string
}

export default function CreateGroupPage() {
  const [groupName, setGroupName] = useState('')
  const [members, setMembers] = useState<string[]>([])
  const [newMember, setNewMember] = useState('')
  const [description, setDescription] = useState('')

  const router = useRouter()

  const handleAddMember = () => {
    if (!newMember || members.includes(newMember)) return
    if (members.length >= 4) {
      toast.error('לא ניתן להוסיף יותר מ־4 שחקנים')
      return
    }
    setMembers([...members, newMember])
    setNewMember('')
  }

  const handleCreate = () => {
    if (!groupName || members.length < 2) {
      toast.error('יש להזין שם קבוצה ולפחות שני שחקנים')
      return
    }
    const group: Group = {
      name: groupName,
      members,
      description
    }
    console.log('קבוצה חדשה:', group)
    toast.success('הקבוצה נוצרה בהצלחה!')
    router.push('/groups')
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">צור קבוצה חדשה</h1>
      <Input
        placeholder="שם הקבוצה"
        value={groupName}
        onChange={(e) => setGroupName(e.target.value)}
      />
      <div>
        <div className="flex gap-2">
          <Input
            placeholder="הוסף שם שחקן"
            value={newMember}
            onChange={(e) => setNewMember(e.target.value)}
          />
          <Button onClick={handleAddMember}>הוסף</Button>
        </div>
        <div className="text-sm text-muted-foreground mt-1">
          חברי קבוצה ({members.length}/4): {members.join(', ')}
        </div>
      </div>
      <Textarea
        placeholder="תיאור הקבוצה, סגנון, רמה, זמינות..."
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <Button onClick={handleCreate} className="w-full">צור קבוצה</Button>
    </div>
  )
}
