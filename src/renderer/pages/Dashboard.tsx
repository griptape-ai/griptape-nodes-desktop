import React from 'react';

const Dashboard: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-card rounded-lg shadow-sm border border-border p-6">
        <h2 className="text-xl font-semibold mb-4">Welcome to Griptape Nodes Desktop</h2>
        <div className="prose prose-gray dark:prose-invert">
          <p className="text-muted-foreground">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor 
            incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud 
            exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
          </p>
          <p className="text-muted-foreground">
            Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu 
            fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in 
            culpa qui officia deserunt mollit anim id est laborum.
          </p>
          <p className="text-muted-foreground">
            Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque 
            laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi 
            architecto beatae vitae dicta sunt explicabo.
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card rounded-lg shadow-sm border border-border p-6">
          <h3 className="text-lg font-semibold mb-2">Quick Stats</h3>
          <p className="text-2xl font-bold text-primary">42</p>
          <p className="text-sm text-muted-foreground">Active Nodes</p>
        </div>
        <div className="bg-card rounded-lg shadow-sm border border-border p-6">
          <h3 className="text-lg font-semibold mb-2">Engine Status</h3>
          <p className="text-2xl font-bold text-green-600">Running</p>
          <p className="text-sm text-muted-foreground">All systems operational</p>
        </div>
        <div className="bg-card rounded-lg shadow-sm border border-border p-6">
          <h3 className="text-lg font-semibold mb-2">Resources</h3>
          <p className="text-2xl font-bold text-primary">8.2 GB</p>
          <p className="text-sm text-muted-foreground">Memory available</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;