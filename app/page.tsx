'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { nanoid } from 'nanoid';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Palette, Users, Zap } from 'lucide-react';

export default function HomePage() {
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();

  const createNewBoard = async () => {
    setIsCreating(true);
    const roomId = nanoid(10);
    router.push(`/room/${roomId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-bold text-gray-900">
            Sketch<span className="text-blue-600">Together</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Create, collaborate, and share ideas in real-time with our powerful 
            collaborative whiteboard platform.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="text-center">
            <CardHeader>
              <Palette className="h-12 w-12 text-blue-600 mx-auto mb-2" />
              <CardTitle>Rich Drawing Tools</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Professional drawing tools including brushes, shapes, and colors
              </CardDescription>
            </CardContent>
          </Card>
          
          <Card className="text-center">
            <CardHeader>
              <Users className="h-12 w-12 text-green-600 mx-auto mb-2" />
              <CardTitle>Real-time Collaboration</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Work together with live cursors and instant synchronization
              </CardDescription>
            </CardContent>
          </Card>
          
          <Card className="text-center">
            <CardHeader>
              <Zap className="h-12 w-12 text-purple-600 mx-auto mb-2" />
              <CardTitle>Instant Setup</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                No signup required. Create a board and share the link instantly
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* CTA Section */}
        <div className="text-center">
          <Button 
            onClick={createNewBoard}
            disabled={isCreating}
            size="lg"
            className="text-lg px-8 py-4 h-auto bg-blue-600 hover:bg-blue-700"
          >
            {isCreating ? 'Creating Board...' : 'Create New Board'}
          </Button>
          <p className="text-sm text-gray-500 mt-4">
            Free to use • No account required • Share with anyone
          </p>
        </div>
      </div>
    </div>
  );
}