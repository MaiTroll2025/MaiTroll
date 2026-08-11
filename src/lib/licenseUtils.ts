// License system constants and utilities

export const LICENSE_STATUSES = {
  NONE: 'none',
  ACTIVE: 'active',
  SUSPENDED: 'suspended'
} as const

export type LicenseStatus = typeof LICENSE_STATUSES[keyof typeof LICENSE_STATUSES]

export const DRIVER_TEST_QUESTIONS = [
  {
    question: 'What is required to legally drive in Mai Troll?',
    options: ['Just a car', 'A license and registered vehicle', 'Coins only', 'Nothing'],
    correct: 1
  },
  {
    question: 'What happens if you drive without a license?',
    options: ['Nothing', 'You earn coins', 'You may be suspended', 'You get a free upgrade'],
    correct: 2
  },
  {
    question: 'What does an ACTIVE license mean?',
    options: ['You can repair cars', 'You can drive and use vehicles', 'You get coins', 'You own multiple cars'],
    correct: 1
  },
  {
    question: 'What is required to broadcast in Mai Troll?',
    options: ['A vehicle only', 'Active license', 'Coins', 'Followers'],
    correct: 1
  },
  {
    question: 'Can a suspended user join a broadcast seat?',
    options: ['No', 'Yes'],
    correct: 1
  },
  {
    question: 'Can you broadcast while your license is suspended?',
    options: ['Yes', 'No'],
    correct: 1
  },
  {
    question: 'What must you do after a driving violation if insurance is required?',
    options: ['Nothing', 'Buy insurance and pass the driver test', 'Log out', 'Join a stream'],
    correct: 1
  },
  {
    question: 'What does car insurance help cover?',
    options: ['Vehicle damage and vandalism', 'Free followers', 'Free broadcast themes', 'Avatar colors'],
    correct: 0
  },
  {
    question: 'Without active insurance, vehicle repairs cost:',
    options: ['Nothing', 'Full repair cost', 'Free after one day', 'Half price always'],
    correct: 1
  },
  {
    question: 'What is a deductible?',
    options: ['A partial amount paid before insurance covers damage', 'A free coin bonus', 'A license plate', 'A broadcast seat'],
    correct: 0
  }
]

export const DRIVER_TEST_PASSING_SCORE = 0.8 // 80%

export function getLicenseStatusLabel(status: LicenseStatus): string {
  switch (status) {
    case LICENSE_STATUSES.NONE:
      return 'No License'
    case LICENSE_STATUSES.ACTIVE:
      return 'Active'
    case LICENSE_STATUSES.SUSPENDED:
      return 'Suspended'
    default:
      return 'Unknown'
  }
}

export function canUserBroadcast(licenseStatus: LicenseStatus): boolean {
  return licenseStatus === LICENSE_STATUSES.ACTIVE
}

export function canUserDrive(licenseStatus: LicenseStatus): boolean {
  return licenseStatus === LICENSE_STATUSES.ACTIVE
}

export function canUserJoinSeat(licenseStatus: LicenseStatus): boolean {
  // Suspended users can join seats, only active users can broadcast
  return licenseStatus === LICENSE_STATUSES.ACTIVE || licenseStatus === LICENSE_STATUSES.SUSPENDED
}

export function getLicenseStatusColor(status: LicenseStatus): string {
  switch (status) {
    case LICENSE_STATUSES.NONE:
      return 'text-gray-400'
    case LICENSE_STATUSES.ACTIVE:
      return 'text-green-400'
    case LICENSE_STATUSES.SUSPENDED:
      return 'text-red-400'
    default:
      return 'text-gray-400'
  }
}