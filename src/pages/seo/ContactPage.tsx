import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import SEOLayout, { Breadcrumb, CTASection } from './SEOLayout'
import { Mail, MessageSquare, MapPin, Clock, Send, CheckCircle, HelpCircle, Shield, Users } from 'lucide-react'

const contactMethods = [
  {
    icon: Mail,
    title: 'Email Us',
    description: 'Send us an email and we\'ll respond within 24 hours.',
    action: 'ceo@maitroll.com',
    link: 'mailto:Mai Troll2025@gmail.com'
  },
  {
    icon: MessageSquare,
    title: 'Support Ticket',
    description: 'Submit a support ticket for account or technical issues.',
    action: 'Open a Ticket',
    link: '/support'
  },
  {
    icon: Users,
    title: 'Community',
    description: 'Join the conversation and get help from other users.',
    action: 'Visit Community',
    link: '/explore'
  },
]

const faqPreview = [
  {
    question: 'How do I reset my password?',
    answer: 'Go to the login page and click "Forgot Password" to receive a reset link via email.'
  },
  {
    question: 'How do I report a bug?',
    answer: 'Use the Bug Center in the app or email us at bugs@maiMaiTroll.com with details.'
  },
  {
    question: 'How do I delete my account?',
    answer: 'Go to Profile Settings > Account > Delete Account. This action is irreversible.'
  },
]

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    setName('')
    setEmail('')
    setSubject('')
    setMessage('')
  }

  return (
    <SEOLayout
      title="Contact Us | Mai Troll"
      description="Contact Mai Troll (MaiMaiTroll) support team. Get help with your account, report issues, or send feedback. We're here to help."
      keywords={[
        'contact Mai Troll', 'MaiTroll support', 'MaiMaiTroll contact',
        'help desk', 'customer support', 'report issue', 'feedback',
        'MaiTroll email', 'MaiTroll help'
      ]}
    >
      <Breadcrumb items={[{ label: 'Contact' }]} />

      <section className="relative py-20 lg:py-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-slate-900 to-pink-900/20" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
              Contact{' '}
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
                Us
              </span>
            </h1>
            <p className="text-xl text-slate-300 mb-8 leading-relaxed">
              Have a question, feedback, or need help? We'd love to hear from you.
              Choose the best way to reach us below.
            </p>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-6">
            {contactMethods.map((method, index) => {
              const Icon = method.icon
              return (
                <a
                  key={index}
                  href={method.link}
                  className="p-6 bg-slate-900/50 border border-slate-800 hover:border-purple-500/30 rounded-2xl transition-all hover:bg-slate-800/50 text-center"
                >
                  <div className="w-12 h-12 rounded-xl bg-purple-600/20 flex items-center justify-center mx-auto mb-4">
                    <Icon className="w-6 h-6 text-purple-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{method.title}</h3>
                  <p className="text-slate-400 text-sm mb-4">{method.description}</p>
                  <span className="text-purple-400 text-sm font-medium">{method.action}</span>
                </a>
              )
            })}
          </div>
        </div>
      </section>

      <section className="py-16 bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12">
            <div>
              <h2 className="text-3xl font-bold text-white mb-6">Send Us a Message</h2>
              <p className="text-slate-400 mb-8">
                Fill out the form and we'll get back to you as soon as possible.
              </p>

              {submitted ? (
                <div className="p-8 bg-green-900/20 border border-green-500/30 rounded-2xl text-center">
                  <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">Message Sent!</h3>
                  <p className="text-slate-400">Thank you for reaching out. We'll respond within 24 hours.</p>
                  <button
                    onClick={() => setSubmitted(false)}
                    className="mt-4 px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors"
                  >
                    Send Another Message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="contact-name" className="block text-sm text-slate-400 mb-2">Name</label>
                      <input
                        id="contact-name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500"
                        placeholder="Your name"
                      />
                    </div>
                    <div>
                      <label htmlFor="contact-email" className="block text-sm text-slate-400 mb-2">Email</label>
                      <input
                        id="contact-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500"
                        placeholder="your@email.com"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="contact-subject" className="block text-sm text-slate-400 mb-2">Subject</label>
                    <input
                      id="contact-subject"
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500"
                      placeholder="What is this regarding?"
                    />
                  </div>
                  <div>
                    <label htmlFor="contact-message" className="block text-sm text-slate-400 mb-2">Message</label>
                    <textarea
                      id="contact-message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      required
                      rows={5}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 resize-none"
                      placeholder="Tell us how we can help..."
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl hover:from-purple-500 hover:to-pink-500 transition-all flex items-center justify-center gap-2"
                  >
                    <Send className="w-5 h-5" />
                    Send Message
                  </button>
                </form>
              )}
            </div>

            <div>
              <h2 className="text-3xl font-bold text-white mb-6">Frequently Asked Questions</h2>
              <p className="text-slate-400 mb-8">
                Quick answers to common questions. For more, visit our <Link to="/faq" className="text-purple-400 hover:text-purple-300">FAQ page</Link>.
              </p>
              <div className="space-y-4">
                {faqPreview.map((faq, index) => (
                  <div key={index} className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
                    <h4 className="text-white font-medium mb-2 flex items-start gap-2">
                      <HelpCircle className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                      {faq.question}
                    </h4>
                    <p className="text-slate-400 text-sm pl-7">{faq.answer}</p>
                  </div>
                ))}
              </div>
              <div className="mt-8 p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
                <div className="flex items-center gap-3 mb-2">
                  <Clock className="w-5 h-5 text-purple-400" />
                  <h4 className="text-white font-medium">Response Time</h4>
                </div>
                <p className="text-slate-400 text-sm">We typically respond to all inquiries within 24 hours during business days.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <CTASection
        title="Need Immediate Help?"
        description="Visit our Help Center for instant answers to common questions."
        primaryAction={{ label: 'Visit Help Center', path: '/support' }}
        secondaryAction={{ label: 'Read FAQ', path: '/faq' }}
      />
    </SEOLayout>
  )
}
