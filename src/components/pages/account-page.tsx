"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import type { UserProfile } from '@/lib/types';
import { Badge } from '../ui/badge';

interface AccountPageProps {
  userProfile: UserProfile;
  onUpdateProfile: (profile: UserProfile) => void;
}

export default function AccountPage({ userProfile, onUpdateProfile }: AccountPageProps) {
  const [profile, setProfile] = useState(userProfile);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setProfile(p => ({ ...p, [id]: value }));
  };

  const handlePrefChange = (id: keyof UserProfile['preferences'], value: boolean) => {
    setProfile(p => ({
      ...p,
      preferences: {
        ...p.preferences,
        [id]: value
      }
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile(profile);
  };

  return (
    <div className="container mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-headline mb-8">Account Settings</h1>
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-1">
            <Card>
              <CardHeader className="items-center text-center">
                <Avatar className="w-24 h-24 mb-4">
                  <AvatarImage src={`https://i.pravatar.cc/150?u=${profile.id}`} alt={profile.firstName} />
                  <AvatarFallback>{profile.firstName[0]}{profile.lastName[0]}</AvatarFallback>
                </Avatar>
                <CardTitle className="text-2xl">{profile.firstName} {profile.lastName}</CardTitle>
                <CardDescription>{profile.email}</CardDescription>
                <Badge className="mt-2" variant={profile.isKyVerified === 'VERIFIED' ? 'default' : 'destructive'}>
                  KYC {profile.isKyVerified}
                </Badge>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">Change Photo</Button>
              </CardContent>
            </Card>
          </div>

          <div className="md:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>Update your personal details here.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input id="firstName" value={profile.firstName} onChange={handleInputChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input id="lastName" value={profile.lastName} onChange={handleInputChange} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={profile.email} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" value={profile.phone} onChange={handleInputChange} />
                </div>
                 <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea id="bio" value={profile.bio} onChange={handleInputChange} />
                </div>
                <div className="flex justify-end">
                    <Button type="submit">Save Changes</Button>
                </div>
              </CardContent>
            </Card>

             <Card className="mt-8">
              <CardHeader>
                <CardTitle>Notifications</CardTitle>
                <CardDescription>Manage your notification preferences.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                        <Label>Email Notifications</Label>
                        <p className="text-sm text-muted-foreground">Receive updates and alerts via email.</p>
                    </div>
                    <Switch checked={profile.preferences.emailNotifications} onCheckedChange={(v) => handlePrefChange('emailNotifications', v)} />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                        <Label>Push Notifications</Label>
                        <p className="text-sm text-muted-foreground">Get real-time alerts on your mobile device.</p>
                    </div>
                    <Switch checked={profile.preferences.pushNotifications} onCheckedChange={(v) => handlePrefChange('pushNotifications', v)} />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
