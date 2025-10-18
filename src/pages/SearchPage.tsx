import React from 'react';
import { FiSearch, FiMapPin, FiUsers } from 'react-icons/fi';

export default function SearchPage() {
    const [searchQuery, setSearchQuery] = React.useState('');

    const locations = [
        { name: 'Cork', users: 234, posts: 156 },
        { name: 'Galway', users: 189, posts: 98 },
        { name: 'Limerick', users: 167, posts: 87 },
        { name: 'Waterford', users: 145, posts: 76 },
        { name: 'Kilkenny', users: 123, posts: 65 },
        { name: 'Sligo', users: 98, posts: 54 },
        { name: 'Donegal', users: 87, posts: 43 },
        { name: 'Kerry', users: 76, posts: 38 },
    ];

    const filteredLocations = locations.filter(location =>
        location.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="p-4 space-y-4">
            {/* Header */}
            <div className="text-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                    Discover Locations
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                    Explore posts from around Ireland
                </p>
            </div>

            {/* Search Bar */}
            <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search locations..."
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
            </div>

            {/* Locations Grid */}
            <div className="space-y-3">
                {filteredLocations.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <FiMapPin size={48} className="mx-auto mb-4 opacity-50" />
                        <p>No locations found</p>
                        <p className="text-sm">Try a different search term</p>
                    </div>
                ) : (
                    filteredLocations.map((location) => (
                        <div
                            key={location.name}
                            className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center">
                                    <FiMapPin className="text-brand-600 dark:text-brand-400" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                                        {location.name}
                                    </h3>
                                    <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                                        <span className="flex items-center gap-1">
                                            <FiUsers size={14} />
                                            {location.users} users
                                        </span>
                                        <span>{location.posts} posts</span>
                                    </div>
                                </div>
                            </div>
                            <button className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors">
                                Follow
                            </button>
                        </div>
                    ))
                )}
            </div>

            {/* Popular Tags */}
            <div className="mt-8">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                    Popular Tags
                </h2>
                <div className="flex flex-wrap gap-2">
                    {['#DublinLife', '#IrishFood', '#TravelIreland', '#CityViews', '#LocalEvents', '#Foodie', '#Adventure', '#Culture'].map((tag) => (
                        <button
                            key={tag}
                            className="px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        >
                            {tag}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
