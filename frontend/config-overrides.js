const webpack = require('webpack');

module.exports = function override(config) {
    // 1. Fix "fully specified" error for process/browser
    config.resolve.alias = {
        ...config.resolve.alias,
        'process/browser': require.resolve('process/browser'),
    };

    // 2. Add Polyfills
    const fallback = config.resolve.fallback || {};
    Object.assign(fallback, {
        "crypto": false,
        "stream": require.resolve("stream-browserify"),
        "assert": false,
        "http": false,
        "https": false,
        "os": false,
        "url": false,
        "buffer": require.resolve("buffer/"),
        "process": require.resolve("process/browser"),
    });
    config.resolve.fallback = fallback;

    // 3. Provide Global Variables
    config.plugins = (config.plugins || []).concat([
        new webpack.ProvidePlugin({
            process: 'process/browser',
            Buffer: ['buffer', 'Buffer']
        })
    ]);

    return config;
};
