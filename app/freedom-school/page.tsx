import { FreedomSchoolPlayer } from "@/components/freedom-school-player"

export default function FreedomSchoolPage() {
  return (
    <div className="min-h-screen bg-black">
      <FreedomSchoolPlayer
        videoId={1}
        videoUrl="https://bttv-videos.s3.amazonaws.com/freedom-school/intro.mp4"
        title="Freedom School Introduction"
        fallbackUrl="https://bttv-videos.s3.amazonaws.com/freedom-school/welcome.mp4"
      />
    </div>
  )
}
