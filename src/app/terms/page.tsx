'use client';

import React from 'react';
import { ClientLayout } from '../client/layout';
import { ChevronRight, ShieldCheck, Scale, FileText, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function TermsPage() {
  const clauses = [
    { title: "1. Acceptance of Terms", content: "By creating an account or using any service provided by Urban Express, you agree to be bound by these Terms and Conditions. If you do not agree, please do not use our facilities or digital platforms." },
    { title: "2. Eligibility", content: "You must be at least 18 years of age to establish a member account. Use of the Lounge services involving alcohol strictly requires valid identification." },
    { title: "3. Account Security", content: "Users are responsible for maintaining the confidentiality of their credentials. Any activity performed under your account is your legal responsibility." },
    { title: "4. Personal Information", content: "We collect data as outlined in our Privacy Policy to enhance your experience. We do not sell user data to third parties." },
    { title: "5. Service Accuracy", content: "While we strive for 100% accuracy, Urban Express is not liable for technical errors in the digital catalog or minor discrepancies in estimated service times." },
    { title: "6. Pricing and Currency", content: "All prices are listed in Kenya Shillings (KES). Urban Express reserves the right to adjust pricing without prior notice based on market conditions." },
    { title: "7. Taxation", content: "Listed prices are inclusive of the standard 16% Value Added Tax (VAT) as required by Kenyan law, unless stated otherwise." },
    { title: "8. Payment Processing", content: "We utilize Paystack for secure cashless transactions. Urban Express does not store full credit card details on its servers." },
    { title: "9. Cash Transactions", content: "Cash payments are accepted at physical terminals. It is the user's responsibility to verify the change issued before leaving the counter." },
    { title: "10. Loyalty Program", content: "Points earned have no cash value and cannot be exchanged for currency. Points expire after 12 months of account inactivity." },
    { title: "11. Appointment Cancellation", content: "Cancellations for carwash or detailing must be made at least 2 hours prior to the scheduled slot to avoid a processing fee." },
    { title: "12. VALET INSURANCE DISCLAIMER", content: "URBAN EXPRESS DOES NOT PROVIDE VALET INSURANCE. All vehicles handled, parked, or transported by our team must be fully insured by the owner. We are not liable for any third-party accidents." },
    { title: "13. Vehicle Risk", content: "Vehicle owners assume all inherent risks associated with high-pressure washing and mechanical detailing. Urban Express is not liable for pre-existing mechanical failures." },
    { title: "14. Personal Property", content: "Urban Express is NOT responsible for any personal items, electronics, or valuables left inside vehicles during service or while parked on our premises." },
    { title: "15. Pre-Service Inspection", content: "Our staff will conduct a visual inspection. Pre-existing scratches, dents, or paint defects will be logged and are not the responsibility of Urban Express." },
    { title: "16. Damage Claims", content: "Any claims for damage caused during service must be reported and documented BEFORE the vehicle leaves the Urban Express premises." },
    { title: "17. Right to Refuse", content: "We reserve the right to refuse service to any individual displaying abusive behavior or vehicles in a condition that poses a hazard to our staff." },
    { title: "18. Lounge Conduct", content: "Professional decorum is expected in the Executive Lounge. Intoxicated individuals will be denied further service and asked to vacate for safety." },
    { title: "19. Digital Usage", content: "Use of our complimentary high-speed fiber is for legal business and personal use only. Unauthorized network activities will result in immediate termination of access." },
    { title: "20. Accessory Returns", content: "Store items may be returned within 7 days if they are in original, unopened packaging and accompanied by a valid system receipt." },
    { title: "21. Product Warranty", content: "Warranty for lubricants, tires, and parts is strictly limited to the manufacturer’s specific terms and conditions." },
    { title: "22. Service Completion", content: "Estimated completion times are targets. Urban Express is not liable for delays caused by unforeseen technical requirements or weather conditions." },
    { title: "23. Intellectual Property", content: "All branding, logos, and 'Business OS' software interfaces are the exclusive property of Urban Express Engineering." },
    { title: "24. User Conduct", content: "Users shall not attempt to reverse engineer our POS systems or bypass security protocols in the Employee Portal." },
    { title: "25. Indemnification", content: "You agree to indemnify and hold Urban Express harmless from any claims, losses, or damages resulting from your violation of these terms." },
    { title: "26. Limitation of Liability", content: "Our total liability for any claim shall not exceed the amount paid for the specific service that is the subject of the dispute." },
    { title: "27. Force Majeure", content: "We are not liable for failure to perform due to acts of God, power outages, network failures, or civil unrest." },
    { title: "28. Governing Law", content: "These terms are governed by the laws of the Republic of Kenya. Any legal proceedings will be held in the courts of Nakuru." },
    { title: "29. Severability", content: "If any part of these terms is found invalid by a court, the remaining clauses shall continue in full force and effect." },
    { title: "30. Modifications", content: "Urban Express may update these terms at any time. Continued use of the platform constitutes acceptance of the revised terms." },
    { title: "31. Contact Information", content: "Legal inquiries can be directed to legal@urbanautoexpress.com or our Flagship Branch in Nakuru." }
  ];

  return (
    <ClientLayout>
      <div className="flex flex-col min-h-screen">
        <section className="bg-zinc-50 border-b border-zinc-100 py-12">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.3em] text-zinc-400 mb-2">
              <Link href="/" className="hover:text-primary transition-colors">HOME</Link> <ChevronRight className="w-2.5 h-2.5" /> <span className="text-primary">LEGAL</span>
            </div>
            <h1 className="text-5xl md:text-8xl font-black font-headline text-zinc-900 uppercase tracking-tighter leading-none">
              Terms of <br/> <span className="text-primary">Service.</span>
            </h1>
            <p className="text-lg text-zinc-500 font-bold uppercase tracking-widest mt-6 max-w-2xl">
              Our commitment to quality service, transparency, and the mutual protection of our community.
            </p>
          </div>
        </section>

        <section className="py-24 bg-white">
          <div className="max-w-4xl mx-auto px-6">
             <div className="p-8 bg-amber-50 rounded-[2rem] border border-amber-100 flex items-start gap-6 mb-16 animate-pulse">
                <AlertTriangle className="w-8 h-8 text-amber-600 shrink-0 mt-1" />
                <div className="space-y-1">
                   <h3 className="text-sm font-black uppercase tracking-widest text-amber-900">Critical Valet Notice</h3>
                   <p className="text-xs font-bold text-amber-700 leading-relaxed uppercase">
                     URBAN EXPRESS DOES NOT PROVIDE VALET INSURANCE. ALL VEHICLES MUST BE FULLY INSURED BY THE OWNER PRIOR TO SERVICE.
                   </p>
                </div>
             </div>

             <div className="space-y-12">
                {clauses.map((item, index) => (
                  <div key={index} className="space-y-3 group">
                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-900 group-hover:text-primary transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-sm text-zinc-500 font-medium leading-relaxed uppercase tracking-tight">
                      {item.content}
                    </p>
                  </div>
                ))}
             </div>

             <div className="mt-24 pt-12 border-t border-zinc-100 flex flex-col items-center text-center space-y-6">
                <div className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center text-primary">
                   <ShieldCheck className="w-8 h-8" />
                </div>
                <p className="text-[10px] font-black text-zinc-300 uppercase tracking-[0.4em]">
                  Urban Express Hospitality & Automotive <br/> Last Updated: August 2024
                </p>
             </div>
          </div>
        </section>
      </div>
    </ClientLayout>
  );
}
