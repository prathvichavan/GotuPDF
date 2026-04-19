export default function Loading() {
    return (
        <div className="min-h-screen bg-white dark:bg-[#0a0e1a] transition-colors duration-300">
            {/* Hero Skeleton */}
            <div className="relative py-12 md:py-16 flex items-center overflow-hidden">
                <div className="w-full px-6 sm:px-8 lg:px-12 xl:px-16">
                    <div className="max-w-4xl w-full mx-auto text-center flex flex-col items-center animate-pulse">
                        {/* Title skeleton */}
                        <div className="h-12 md:h-16 bg-gray-200 dark:bg-slate-800 rounded-xl w-3/4 mb-6" />
                        {/* Subtitle skeleton */}
                        <div className="h-6 bg-gray-200 dark:bg-slate-800 rounded-lg w-2/3 mb-3" />
                        <div className="h-6 bg-gray-200 dark:bg-slate-800 rounded-lg w-1/2" />
                    </div>
                </div>
            </div>

            {/* Tools Section Skeleton */}
            <div className="py-20 px-6 sm:px-8 lg:px-12 xl:px-16">
                <div className="animate-pulse">
                    {/* Section header */}
                    <div className="mb-10">
                        <div className="h-8 bg-gray-200 dark:bg-slate-800 rounded-lg w-64 mb-3" />
                        <div className="h-5 bg-gray-200 dark:bg-slate-800 rounded-lg w-96" />
                    </div>
                    
                    {/* Category tabs skeleton */}
                    <div className="flex gap-2 mb-8">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="h-10 bg-gray-200 dark:bg-slate-800 rounded-xl w-24" />
                        ))}
                    </div>

                    {/* Tool cards skeleton */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                        {[...Array(8)].map((_, i) => (
                            <div key={i} className="rounded-2xl border border-gray-200 dark:border-white/10 p-6 bg-gray-50 dark:bg-slate-900/50">
                                <div className="w-14 h-14 bg-gray-200 dark:bg-slate-800 rounded-xl mb-4" />
                                <div className="h-5 bg-gray-200 dark:bg-slate-800 rounded-lg w-3/4 mb-2" />
                                <div className="h-4 bg-gray-200 dark:bg-slate-800 rounded-lg w-full mb-1" />
                                <div className="h-4 bg-gray-200 dark:bg-slate-800 rounded-lg w-2/3" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
