import { useEffect, useState } from "react"
import AdminApplications from "./components/AdminApplications"
import PhoneAdminApplications from "../../phone/PhoneAdminApplications"

export default function ApplicationsPage() {
  const [isPhone, setIsPhone] = useState(false)

  useEffect(() => {
    const checkPhone = () => {
      setIsPhone(window.innerWidth < 1024)
    }

    checkPhone()
    window.addEventListener("resize", checkPhone)

    return () => window.removeEventListener("resize", checkPhone)
  }, [])

  if (isPhone) {
    return <PhoneAdminApplications />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <AdminApplications />
      </div>
    </div>
  )
}
