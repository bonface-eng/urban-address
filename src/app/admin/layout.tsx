import React from 'react';
import {AdminDailyOtpGuard} from '@/components/auth/admin-daily-otp-guard';
export default function AdminLayout({children}:{children:React.ReactNode}){
 return <AdminDailyOtpGuard>{children}</AdminDailyOtpGuard>;
}
