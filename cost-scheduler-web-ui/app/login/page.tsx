'use client'

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';


const Login: React.FC = () => {
    const router = useRouter();
    const { data: session, status } = useSession();

    useEffect(() => {
        if (session?.user) {
            router.push('/');
        }
    }, [session, router]);

    const handleSignInWithGoogle = async (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        try {
            const result = await signIn("cognito");
            if (result?.error) {
                console.error('Authentication error:', result.error);
            }
        } catch (error) {
            console.error('Sign in error:', error);
        }
    }; return (
        <div className="flex min-h-screen">
            <div className="w-1/2 relative bg-left bg-no-repeat">                <Image src="/smc-global-securities-logo.jpg" alt="smc-global-securities-logo" width={100} height={100} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 flex justify-center items-center bg-[#f0f2f5] p-6">
                <Card className="mx-auto max-w-sm">
                    <CardHeader>
                        <CardTitle className="text-2xl">Login</CardTitle>
                        <CardDescription>
                            Click the button below to login to your account
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4">
                            <div className="grid gap-2">
                                <Button variant="outline" onClick={handleSignInWithGoogle} className="w-full">
                                    Login
                                </Button>
                            </div>

                        </div>
                        <div className="mt-4 text-center text-sm">
                            Don&apos;t have an account?{" "}
                            <span onClick={handleSignInWithGoogle} className="underline cursor-pointer">
                                Sign up
                            </span>
                        </div>
                    </CardContent>
                </Card>

            </div>

        </div>

    );
};

export default Login;
