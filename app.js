// The only market-data request used by this app.
const MARKET_API_URL = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&x_cg_demo_api_key=CG-wgb2jwQBYcwfQPAuh6oMLrG5';
const DISPLAY_LIMIT = 20;
const WATCHLIST_STORAGE_KEY = 'bitora-watchlist';
const THEME_STORAGE_KEY = 'bitora-theme';

// Find the page elements that JavaScript will update.
const resultsContainer = document.querySelector('#market-results');
const refreshButton = document.querySelector('#refresh-button');
const updatedLabel = document.querySelector('#last-updated');
const searchInput = document.querySelector('#coin-search');
const clearSearchButton = document.querySelector('#clear-search');
const sectionCaption = document.querySelector('#section-caption');
const sortSelect = document.querySelector('#sort-by');
const sortDirectionButton = document.querySelector('#sort-direction');
const sortDirectionLabel = document.querySelector('#sort-direction-label');
const sortDirectionIcon = document.querySelector('#sort-direction-icon');
const watchlistCount = document.querySelector('#watchlist-count');
const marketTitle = document.querySelector('#market-title');
const marketTools = document.querySelector('.market-tools');
const tableWrap = document.querySelector('#market-table-wrap');
const coinDetailView = document.querySelector('#coin-detail-view');
const sidebar = document.querySelector('.sidebar');
const themeToggle = document.querySelector('#theme-toggle');
const themeToggleIcon = document.querySelector('#theme-toggle-icon').querySelector('i');
const themeToggleLabel = document.querySelector('#theme-toggle-label');

// These variables remember data and choices while the page is open.
let marketCoins = [];
let watchlistCoins = [];
let currentView = 'markets';
let detailReturnView = 'markets';
let selectedCoinId = null;
let sortDescending = true;
let searchTimer;

// Format the market values before showing them on screen.
const compactMoneyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 2
});
const supplyFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

function formatPrice(value) {
    if (value == null || !Number.isFinite(Number(value))) return '—';

    const price = Number(value);
    const decimalPlaces = price < 1 ? 6 : 2;
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: decimalPlaces
    }).format(price);
}

function formatMarketCap(value) {
    if (value == null || !Number.isFinite(Number(value))) return '—';
    return compactMoneyFormatter.format(Number(value));
}

function formatChange(value) {
    if (value == null || !Number.isFinite(Number(value))) return '—';

    const change = Number(value);
    const sign = change > 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}%`;
}

// function formatSupply(value, symbol) {
//     if (value == null || !Number.isFinite(Number(value))) return '—';

//     const amount = supplyFormatter.format(Number(value));
//     const coinSymbol = symbol ? symbol.toUpperCase() : '';
//     return `${amount} ${coinSymbol}`.trim();
// }

// Show placeholder rows while the market request is running.
function showLoadingRows() {
    const rows = document.createDocumentFragment();

    for (let index = 0; index < DISPLAY_LIMIT; index += 1) {
        const row = document.createElement('div');
        row.className = 'market-table market-row skeleton-row';
        // row.setAttribute('aria-hidden', 'true');
        row.innerHTML = '<span class="col-asset skeleton-asset"><i></i><b></b><b></b></span><span class="col-price align-right"><i></i></span><span class="col-change align-right"><i></i></span><span class="col-cap align-right"><i></i></span>';
        rows.append(row);
    }

    resultsContainer.replaceChildren(rows);
    // resultsContainer.setAttribute('aria-busy', 'true');
}

// Build the coin rows from the API data.
function renderCoins(coins, limit = DISPLAY_LIMIT) {
    const rows = document.createDocumentFragment();

    for (let index = 0; index < limit; index += 1) {
        const coin = coins[index];
        const row = document.createElement('article');
        row.className = 'market-table market-row'; //rows apperiance

        const asset = document.createElement('div');
        asset.className = 'asset-cell col-asset';

        const rank = document.createElement('span');
        rank.className = 'asset-rank';
        rank.textContent = String(coin.market_cap_rank || index + 1)

        const image = document.createElement('img');
        image.className = 'coin-image';
        image.src = coin.image || '';
        image.alt = '';
        // image.loading = 'lazy';
        // image.addEventListener('error', () => {
        //     image.hidden = true;
        // }, { once: true });

        const nameButton = document.createElement('button');
        nameButton.className = 'asset-name-wrap asset-detail-button';
        nameButton.type = 'button';
        nameButton.dataset.coinId = coin.id;
        // nameButton.setAttribute('aria-label', `View ${coin.name} details`);

        const name = document.createElement('strong');
        name.className = 'asset-name';
        name.textContent = coin.name || 'Unknown coin';

        const symbol = document.createElement('span');
        symbol.className = 'asset-symbol';
        symbol.textContent = coin.symbol ? coin.symbol.toUpperCase() : '';
        nameButton.append(name, symbol); 

        // The star shows whether this coin is already saved.
        const isSaved = watchlistCoins.some((savedCoin) => savedCoin.id === coin.id);
        const starButton = document.createElement('button');
        starButton.className = isSaved ? 'watchlist-toggle is-saved' : 'watchlist-toggle';
        starButton.type = 'button';
        starButton.dataset.watchlistToggle = '';
        starButton.dataset.coinId = coin.id;
        // starButton.setAttribute('aria-pressed', String(isSaved));
        starButton.setAttribute('aria-label', `${isSaved ? 'Remove' : 'Add'} ${coin.name} ${isSaved ? 'from' : 'to'} watchlist`);

        const starIcon = document.createElement('i');    //decorate star icon when clicked
        starIcon.className = isSaved ? 'fa-solid fa-star' : 'fa-regular fa-star';
        // starIcon.setAttribute('aria-hidden', 'true');
        starButton.append(starIcon);

        asset.append(rank, image, nameButton, starButton);

        const price = document.createElement('span');     //price
        price.className = 'col-price align-right numeric-cell';
        price.textContent = formatPrice(coin.current_price);

        const changeValue = Number(coin.price_change_percentage_24h);    //24 hour changes
        const change = document.createElement('span');
        change.className = 'col-change align-right change-cell';
        change.classList.add(changeValue < 0 ? 'change-negative' : 'change-positive');
        change.textContent = formatChange(coin.price_change_percentage_24h);

        const marketCap = document.createElement('span');     // market cap
        marketCap.className = 'col-cap align-right numeric-cell';
        marketCap.textContent = formatMarketCap(coin.market_cap);

        row.append(asset, price, change, marketCap);
        rows.append(row);
    }

    resultsContainer.replaceChildren(rows);
    // resultsContainer.setAttribute('aria-busy', 'false');
}

// Show a simple message when a search has no matches.
function showNoSearchResults(query) {
    const panel = document.createElement('div');
    panel.className = 'state-panel';

    const title = document.createElement('h3');
    title.textContent = 'No results found';

    const message = document.createElement('p');
    message.textContent = `No coin matched “${query}”. Try another name or ticker symbol.`;

    panel.append(title, message);
    resultsContainer.replaceChildren(panel);
    resultsContainer.setAttribute('aria-busy', 'false');
}

// Search the loaded coins, then apply the selected sort order.
function applySearchAndSort() {
    if (marketCoins.length === 0) return;

    const query = searchInput.value.trim().toLowerCase();
    clearSearchButton.hidden = query === '';

    let matchingCoins = marketCoins;
    if (query !== '') {
        matchingCoins = marketCoins.filter((coin) => {
            const name = (coin.name || '').toLowerCase();
            const symbol = (coin.symbol || '').toLowerCase();
            return name.includes(query) || symbol.includes(query);
        });
    }

    if (query !== '' && matchingCoins.length === 0) {
        sectionCaption.textContent = `No matching coins in the first ${marketCoins.length} market results`;
        showNoSearchResults(query);
        return;
    }

    const sortedCoins = [...matchingCoins];
    sortedCoins.sort((firstCoin, secondCoin) => {
        const firstValue = Number(firstCoin[sortSelect.value]) || 0;
        const secondValue = Number(secondCoin[sortSelect.value]) || 0;

        if (sortDescending) return secondValue - firstValue;
        return firstValue - secondValue;
    });

    const sortNames = {
        market_cap: 'market cap',
        current_price: 'price',
        price_change_percentage_24h: '24h change'
    };
    const direction = sortDescending ? 'high to low' : 'low to high';

    if (query !== '') {
        sectionCaption.textContent = `${matchingCoins.length} matching coins · sorted by ${sortNames[sortSelect.value]} (${direction})`;
        renderCoins(sortedCoins, sortedCoins.length);
        return;
    }

    if (sortSelect.value === 'market_cap' && sortDescending) {
        sectionCaption.textContent = `The ${DISPLAY_LIMIT} largest coins by market capitalization`;
    } else {
        sectionCaption.textContent = `Top ${DISPLAY_LIMIT} coins · sorted by ${sortNames[sortSelect.value]} (${direction})`;
    }

    renderCoins(sortedCoins);
}

function handleSearchInput() {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(applySearchAndSort, 250);
}

// Read saved coins from this browser.
function loadWatchlist() {
    try {
        const savedCoins = JSON.parse(localStorage.getItem(WATCHLIST_STORAGE_KEY) || '[]');
        if (Array.isArray(savedCoins)) return savedCoins;
        return [];
    } catch (error) {
        console.error('Could not read the watchlist:', error);
        return [];
    }
}

function saveWatchlist() {
    try {
        localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(watchlistCoins));
        updatedLabel.textContent = 'Watchlist saved on this device';
    } catch (error) {
        console.error('Could not save the watchlist:', error);
        updatedLabel.textContent = 'Could not save the watchlist in this browser';
    }

    updateWatchlistCount();
}

function updateWatchlistCount() {
    watchlistCount.textContent = watchlistCoins.length;
}

// Replace saved coin data with fresh values after a successful refresh.
function updateSavedCoinData() {
    watchlistCoins = watchlistCoins.map((savedCoin) => {
        const currentCoin = marketCoins.find((coin) => coin.id === savedCoin.id);
        return currentCoin || savedCoin;
    });

    try {
        localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(watchlistCoins));
    } catch (error) {
        console.error('Could not update saved coin data:', error);
    }
}

function showEmptyWatchlist() {
    const panel = document.createElement('div');
    panel.className = 'state-panel';

    const title = document.createElement('h3');
    title.textContent = 'Your watchlist is empty';

    const message = document.createElement('p');
    message.textContent = 'Select the star beside a coin to save it here for later.';

    panel.append(title, message);
    resultsContainer.replaceChildren(panel);
    resultsContainer.setAttribute('aria-busy', 'false');
}

function renderWatchlist() {
    marketTitle.textContent = 'Your watchlist';
    sectionCaption.textContent = `${watchlistCoins.length} coins saved on this device`;
    marketTools.hidden = true;

    if (watchlistCoins.length === 0) {
        showEmptyWatchlist();
        return;
    }

    renderCoins(watchlistCoins, watchlistCoins.length);
}

// These descriptions are local because the selected market endpoint only gives market data.
const coinDescriptions = {
    bitcoin: 'Bitcoin is a decentralized digital currency that can be transferred peer to peer without a central authority.',
    ethereum: 'Ethereum is a programmable blockchain platform for decentralized applications and smart contracts.',
    tether: 'Tether is a stablecoin designed to track the value of the U.S. dollar.',
    binancecoin: 'BNB is the utility token associated with the BNB Chain ecosystem.',
    ripple: 'XRP is a digital asset used by the XRP Ledger for value transfer and settlement.',
    solana: 'Solana is a blockchain platform designed for fast transactions and decentralized applications.',
    'usd-coin': 'USD Coin is a stablecoin designed to track the value of the U.S. dollar.',
    dogecoin: 'Dogecoin is a peer-to-peer cryptocurrency that began as a lighthearted digital currency.',
    tron: 'TRON is a blockchain network that supports decentralized applications and digital assets.',
    'the-open-network': 'Toncoin is the native cryptocurrency of The Open Network blockchain ecosystem.'
};

function createDetailStat(label, value, extraClass = '') {
    const item = document.createElement('div');
    item.className = 'detail-stat';

    const labelElement = document.createElement('span');
    labelElement.className = 'detail-stat-label';
    labelElement.textContent = label;

    const valueElement = document.createElement('strong');
    valueElement.className = `detail-stat-value ${extraClass}`.trim();
    valueElement.textContent = value;

    item.append(labelElement, valueElement);
    return item;
}

function renderCoinDetail(coin) {
    marketTitle.textContent = `${coin.name} details`;
    coinDetailView.replaceChildren();

    const backButton = document.createElement('button');
    backButton.className = 'detail-back-button';
    backButton.type = 'button';
    backButton.textContent = '← Back to market';
    backButton.addEventListener('click', () => {
        currentView = detailReturnView;
        renderCurrentView();
    });

    const hero = document.createElement('div');
    hero.className = 'detail-hero';

    const image = document.createElement('img');
    image.className = 'detail-coin-image';
    image.src = coin.image || '';
    image.alt = '';
    image.addEventListener('error', () => {
        image.hidden = true;
    }, { once: true });

    const identity = document.createElement('div');
    identity.className = 'detail-identity';

    const name = document.createElement('h3');
    name.textContent = coin.name || 'Unknown coin';

    const symbol = document.createElement('p');
    symbol.textContent = coin.symbol ? coin.symbol.toUpperCase() : '';
    identity.append(name, symbol);

    const rank = document.createElement('span');
    rank.className = 'detail-rank';
    if (coin.market_cap_rank) rank.textContent = `Market rank #${coin.market_cap_rank}`;
    else rank.textContent = 'Market rank unavailable';
    hero.append(image, identity, rank);

    const about = document.createElement('div');
    about.className = 'detail-about';

    const aboutTitle = document.createElement('h4');
    aboutTitle.textContent = `About ${coin.name || 'this asset'}`;

    const description = document.createElement('p');
    description.textContent = coinDescriptions[coin.id]
        || 'A description is not available in the selected market data feed.';
    about.append(aboutTitle, description);

    const statsTitle = document.createElement('h4');
    statsTitle.className = 'detail-stats-title';
    statsTitle.textContent = 'Market statistics';

    const stats = document.createElement('div');
    stats.className = 'detail-stats';

    const change = Number(coin.price_change_percentage_24h);
    const changeClass = change < 0 ? 'change-negative' : 'change-positive';
    const statistics = [
        ['Price', formatPrice(coin.current_price), ''],
        ['24h change', formatChange(coin.price_change_percentage_24h), changeClass],
        ['Market cap', formatMarketCap(coin.market_cap), ''],
        ['24h volume', formatMarketCap(coin.total_volume), ''],
        // ['Circulating supply', formatSupply(coin.circulating_supply, coin.symbol), ''],
        ['24h high / low', `${formatPrice(coin.high_24h)} / ${formatPrice(coin.low_24h)}`, '']
    ];

    for (const [label, value, extraClass] of statistics) {
        stats.append(createDetailStat(label, value, extraClass));
    }

    coinDetailView.append(backButton, hero, about, statsTitle, stats);
}

function renderCurrentView() {
    const showingWatchlist = currentView === 'watchlist';
    const showingDetails = currentView === 'detail';

    marketTools.hidden = showingWatchlist || showingDetails;
    tableWrap.hidden = showingDetails;
    sectionCaption.hidden = showingDetails;
    coinDetailView.hidden = !showingDetails;

    if (showingDetails) {
        const coin = marketCoins.find((item) => item.id === selectedCoinId)
            || watchlistCoins.find((item) => item.id === selectedCoinId);
        if (coin) renderCoinDetail(coin);
        return;
    }

    if (showingWatchlist) {
        renderWatchlist();
        return;
    }

    marketTitle.textContent = 'Top cryptocurrencies';
    applySearchAndSort();
}

// Load data from the one CoinGecko URL and handle loading, empty, and error states.
async function loadMarketData() {
    refreshButton.disabled = true;
    refreshButton.classList.add('is-refreshing');
    updatedLabel.textContent = 'Updating market data…';
    // resultsContainer.setAttribute('aria-busy', 'true');
    showLoadingRows();

    try {
        const response = await fetch(MARKET_API_URL);
        if (!response.ok) throw new Error('The market request failed.');

        const coins = await response.json();
        if (!Array.isArray(coins) || coins.length === 0) {
            if (currentView === 'markets') showEmptyState();
            else renderCurrentView();
            updatedLabel.textContent = 'No market data returned';
            return;
        }

        marketCoins = coins;
        updateSavedCoinData();
        updateWatchlistCount();
        renderCurrentView();

        const updateTime = new Date().toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit'
        });
        updatedLabel.textContent = `Updated ${updateTime} · Showing the top ${Math.min(coins.length, DISPLAY_LIMIT)} coins`;
    } catch (error) {
        console.error('Unable to load market data:', error);
        if (currentView === 'markets') showErrorState();
        else renderCurrentView();
        updatedLabel.textContent = 'Market data unavailable';
    } finally {
        refreshButton.disabled = false;
        refreshButton.classList.remove('is-refreshing');
    }
}

// Handle clicks on coin stars and coin names with one listener.
function handleResultClick(event) {
    const starButton = event.target.closest('[data-watchlist-toggle]');
    if (starButton) {
        changeWatchlist(starButton.dataset.coinId);
        return;
    }

    const nameButton = event.target.closest('[data-coin-id]');
    if (nameButton) openCoinDetails(nameButton.dataset.coinId);
}

function changeWatchlist(coinId) {
    const coin = marketCoins.find((item) => item.id === coinId)
        || watchlistCoins.find((item) => item.id === coinId);
    if (!coin) return;

    const savedIndex = watchlistCoins.findIndex((item) => item.id === coinId);
    if (savedIndex === -1) watchlistCoins.push(coin);
    else watchlistCoins.splice(savedIndex, 1);

    saveWatchlist();
    renderCurrentView();
}

function openCoinDetails(coinId) {
    const coin = marketCoins.find((item) => item.id === coinId)
        || watchlistCoins.find((item) => item.id === coinId);
    if (!coin) return;

    detailReturnView = currentView;
    selectedCoinId = coinId;
    currentView = 'detail';
    renderCurrentView();
}

function handleSidebarClick(event) {
    const link = event.target.closest('[data-view]');
    if (!link) return;

    event.preventDefault();
    currentView = link.dataset.view;

    const viewLinks = sidebar.querySelectorAll('[data-view]');
    for (const viewLink of viewLinks) {
        const selected = viewLink.dataset.view === currentView;
        viewLink.classList.toggle('nav-link-active', selected);
        if (selected) viewLink.setAttribute('aria-current', 'page');
        else viewLink.removeAttribute('aria-current');
    }

    renderCurrentView();
}

// Read the saved theme, or use light mode the first time.
function loadTheme() {
    try {
        return localStorage.getItem(THEME_STORAGE_KEY) || 'light';
    } catch (error) {
        return 'light';
    }
}

function applyTheme(theme) {
    const darkMode = theme === 'dark';
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light';
    document.documentElement.style.colorScheme = darkMode ? 'dark' : 'light';
    themeToggle.setAttribute('aria-pressed', String(darkMode));
    themeToggle.setAttribute('aria-label', `Switch to ${darkMode ? 'light' : 'dark'} mode`);
    themeToggleIcon.className = darkMode ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    themeToggleLabel.textContent = darkMode ? 'Light mode' : 'Dark mode';
    document.querySelector('meta[name="theme-color"]').content = darkMode ? '#111317' : '#fffaf3';
}

function handleThemeClick() {
    const newTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);

    try {
        localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch (error) {
        console.error('Could not save the theme:', error);
    }
}

function handleSortDirectionClick() {
    sortDescending = !sortDescending;
    const directionText = sortDescending ? 'High to low' : 'Low to high';

    sortDirectionLabel.textContent = directionText;
    sortDirectionButton.setAttribute('aria-label', `Current sort order: ${directionText.toLowerCase()}`);

    const icon = sortDirectionIcon.querySelector('i');
    icon.className = sortDescending ? 'fa-solid fa-arrow-down' : 'fa-solid fa-arrow-up';
    applySearchAndSort();
}

function clearSearch() {
    searchInput.value = '';
    window.clearTimeout(searchTimer);
    applySearchAndSort();
    searchInput.focus();
}

// Read saved preferences, connect buttons, and load the market once on page start.
function startApp() {
    watchlistCoins = loadWatchlist();    
    updateWatchlistCount();                        
    applyTheme(loadTheme());        

    searchInput.addEventListener('input', handleSearchInput);
    clearSearchButton.addEventListener('click', clearSearch);
    sortSelect.addEventListener('change', applySearchAndSort);
    sortDirectionButton.addEventListener('click', handleSortDirectionClick);
    refreshButton.addEventListener('click', loadMarketData);
    resultsContainer.addEventListener('click', handleResultClick);
    sidebar.addEventListener('click', handleSidebarClick);
    themeToggle.addEventListener('click', handleThemeClick);

    loadMarketData();
}

startApp();
