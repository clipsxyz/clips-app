import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiSearch } from 'react-icons/fi';

interface User {
  id: string;
  name: string;
  username: string;
  avatar?: string;
  isFollowing: boolean;
  isVerified: boolean;
  bio?: string;
}

export default function FollowersPage() {
  const nav = useNavigate();
  const { type } = useParams<{ type: 'followers' | 'following' }>();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [users, setUsers] = React.useState<User[]>([]);

  // Mock data - in a real app, this would come from an API
  React.useEffect(() => {
    const mockUsers: User[] = [
      {
        id: '1',
        name: 'John Doe',
        username: 'johndoe',
        isFollowing: true,
        isVerified: false,
        bio: 'Photography enthusiast'
      },
      {
        id: '2',
        name: 'Sarah Wilson',
        username: 'sarahw',
        isFollowing: false,
        isVerified: true,
        bio: 'Travel blogger & content creator'
      },
      {
        id: '3',
        name: 'Mike Chen',
        username: 'mikechen',
        isFollowing: true,
        isVerified: false,
        bio: 'Tech entrepreneur'
      },
      {
        id: '4',
        name: 'Emma Thompson',
        username: 'emmathompson',
        isFollowing: false,
        isVerified: true,
        bio: 'Artist & designer'
      },
      {
        id: '5',
        name: 'David Park',
        username: 'davidpark',
        isFollowing: true,
        isVerified: false,
        bio: 'Fitness coach'
      }
    ];

    // Filter based on type
    const filteredUsers = type === 'following' 
      ? mockUsers.filter(user => user.isFollowing)
      : mockUsers;

    setUsers(filteredUsers);
  }, [type]);

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleFollowToggle = (userId: string) => {
    setUsers(prev => prev.map(user => 
      user.id === userId 
        ? { ...user, isFollowing: !user.isFollowing }
        : user
    ));
  };

  const generateAvatar = (name: string) => {
    const colors = [
      'from-blue-500 to-purple-600',
      'from-green-500 to-teal-600',
      'from-pink-500 to-rose-600',
      'from-yellow-500 to-orange-600',
      'from-indigo-500 to-blue-600',
      'from-red-500 to-pink-600'
    ];
    
    const colorIndex = name.charCodeAt(0) % colors.length;
    return colors[colorIndex];
  };

  const title = type === 'following' ? 'Following' : 'Followers';

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 border-b border-gray-200 dark:border-gray-800">
        <button 
          onClick={() => nav(-1)}
          className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-full transition-colors"
          aria-label="Go back"
        >
          <FiArrowLeft size={24} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{title}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {filteredUsers.length} {type === 'following' ? 'following' : 'followers'}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-100 dark:bg-gray-900 rounded-lg border-0 focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-gray-800 transition-colors"
          />
        </div>
      </div>

      {/* Users List */}
      <div className="pb-20">
        {filteredUsers.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400">
              {searchQuery ? 'No users found' : `No ${type} yet`}
            </p>
          </div>
        ) : (
          filteredUsers.map((user) => (
            <div key={user.id} className="flex items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
              {/* Avatar */}
              <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${generateAvatar(user.name)} flex items-center justify-center text-white font-bold flex-shrink-0`}>
                {user.name.slice(0, 1).toUpperCase()}
              </div>

              {/* User Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="font-semibold truncate">{user.name}</span>
                  {user.isVerified && (
                    <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 truncate">@{user.username}</p>
                {user.bio && (
                  <p className="text-sm text-gray-800 dark:text-gray-200 truncate mt-1">{user.bio}</p>
                )}
              </div>

              {/* Follow Button */}
              <button
                onClick={() => handleFollowToggle(user.id)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex-shrink-0 ${
                  user.isFollowing
                    ? 'bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-700'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
              >
                {user.isFollowing ? 'Following' : 'Follow'}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

