
const MARKET_API_URL = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&x_cg_demo_api_key=CG-wgb2jwQBYcwfQPAuh6oMLrG5';
const DISPLAY_LIMIT = 20;
const resultsContainer = document.querySelector('#market-results');
const refreshButton = document.querySelector('#refresh-button');
const updatedLabel = document.querySelector('#last-updated');
const searchInput = document.querySelector('#coin-search');
const clearSearchButton = document.querySelector('#clear-search');
const sectionCaption = document.querySelector('#section-caption');
const sortSelect = document.querySelector('#sort-by');
const sortDirectionButton = document.querySelector('#sort-direction');
const sortDirectionIcon = document.querySelector('#sort-direction-icon');
const sortDirectionLabel = document.querySelector('#sort-direction-label');
let sortDescending = true;
const SORT_LABELS = {
    market_cap: 'market cap',
    current_price: 'price',
    price_change_percentage_24h: '24h change'
};
let marketCoins = [];
let searchDebounceTimer;

// FEATURE 4: Watchlist persistence, view, and event delegation start here.
const WATCHLIST_STORAGE_KEY = 'bitora-watchlist';
const watchlistCount = document.querySelector('#watchlist-count');
const marketTitle = document.querySelector('#market-title');
const marketTools = document.querySelector('.market-tools');
const sidebar = document.querySelector('.sidebar');
let currentView = 'markets';
let watchlistCoins = loadWatchlist();
const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const compactMoneyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 2
});

// Formatting helpers keep displayed market values consistent.
function formatPrice(value) {
    if (value == null || !Number.isFinite(Number(value))) return '—';
    const digits = Number(value) >= 1 ? 2 : 6;
    return new Intl.NumberFormat('en-US', {
        style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: digits
    }).format(Number(value));
}

function formatMarketCap(value) {
    return Number.isFinite(Number(value)) ? compactMoneyFormatter.format(Number(value)) : '—';
}

function formatChange(value) {
    return Number.isFinite(Number(value)) ? `${Number(value) > 0 ? '+' : ''}${Number(value).toFixed(2)}%` : '—';
}

// Loading placeholders and dynamically rendered coin rows.
function createSkeletonRows() {
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < DISPLAY_LIMIT; index += 1) {
        const row = document.createElement('div');
        row.className = 'market-table market-row skeleton-row';
        row.setAttribute('aria-hidden', 'true');
        row.innerHTML = '<span class="col-asset skeleton-asset"><i></i><b></b><b></b></span><span class="col-price align-right"><i></i></span><span class="col-change align-right"><i></i></span><span class="col-cap align-right"><i></i></span>';
        fragment.append(row);
    }
    return fragment;
}

function renderCoins(coins, limit = DISPLAY_LIMIT) {
    const fragment = document.createDocumentFragment();
    coins.slice(0, limit).forEach((coin, index) => {
        const row = document.createElement('article');
        const change = Number(coin.price_change_percentage_24h);
        const changeClass = Number.isFinite(change) && change < 0 ? 'change-negative' : 'change-positive';
        row.className = 'market-table market-row';

        const asset = document.createElement('div');
        asset.className = 'asset-cell col-asset';
        const rank = document.createElement('span');
        rank.className = 'asset-rank';
        rank.textContent = String(coin.market_cap_rank ?? index + 1).padStart(2, '0');
        const image = document.createElement('img');
        image.className = 'coin-image';
        image.src = coin.image || '';
        image.alt = '';
        image.loading = 'lazy';
        image.addEventListener('error', () => { image.hidden = true; }, { once: true });
        const nameWrap = document.createElement('span');
        nameWrap.className = 'asset-name-wrap';
        const name = document.createElement('strong');
        name.className = 'asset-name';
        name.textContent = coin.name || 'Unknown coin';
        const symbol = document.createElement('span');
        symbol.className = 'asset-symbol';
        symbol.textContent = coin.symbol ? coin.symbol.toUpperCase() : '';
        nameWrap.append(name, symbol);
        const isSaved = watchlistCoins.some((savedCoin) => savedCoin.id === coin.id);
        const watchlistButton = document.createElement('button');
        watchlistButton.className = `watchlist-toggle${isSaved ? ' is-saved' : ''}`;
        watchlistButton.type = 'button';
        watchlistButton.dataset.watchlistToggle = '';
        watchlistButton.dataset.coinId = coin.id;
        watchlistButton.setAttribute('aria-pressed', String(isSaved));
        watchlistButton.setAttribute('aria-label', `${isSaved ? 'Remove' : 'Add'} ${coin.name} ${isSaved ? 'from' : 'to'} watchlist`);
        const starIcon = document.createElement('i');
        starIcon.className = `${isSaved ? 'fa-solid' : 'fa-regular'} fa-star`;
        starIcon.setAttribute('aria-hidden', 'true');
        watchlistButton.append(starIcon);
        asset.append(rank, image, nameWrap, watchlistButton);

        const price = document.createElement('span');
        price.className = 'col-price align-right numeric-cell';
        price.textContent = formatPrice(coin.current_price);
        const changeCell = document.createElement('span');
        changeCell.className = `col-change align-right change-cell ${changeClass}`;
        changeCell.textContent = formatChange(change);
        const cap = document.createElement('span');
        cap.className = 'col-cap align-right numeric-cell';
        cap.textContent = formatMarketCap(coin.market_cap);
        row.append(asset, price, changeCell, cap);
        fragment.append(row);
    });
    resultsContainer.replaceChildren(fragment);
    resultsContainer.setAttribute('aria-busy', 'false');
}

// FEATURE 2: Search — filter the fetched CoinGecko coins by name or symbol.
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

// FEATURE 4: Read, save, and render the user's LocalStorage watchlist.
function loadWatchlist() {
    try {
        const savedCoins = JSON.parse(localStorage.getItem(WATCHLIST_STORAGE_KEY) || '[]');
        return Array.isArray(savedCoins)
            ? savedCoins.filter((coin) => coin && coin.id && coin.name)
            : [];
    } catch (error) {
        console.error('Unable to read the Bitora watchlist:', error);
        return [];
    }
}

function saveWatchlist() {
    try {
        localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(watchlistCoins));
        updatedLabel.textContent = 'Watchlist saved on this device';
    } catch (error) {
        console.error('Unable to save the Bitora watchlist:', error);
        updatedLabel.textContent = 'Could not save the watchlist in this browser';
    }
    updateWatchlistCount();
}

function updateWatchlistCount() {
    watchlistCount.textContent = String(watchlistCoins.length);
}

function syncSavedCoinData(coins) {
    const latestCoins = new Map(coins.map((coin) => [coin.id, coin]));
    let changed = false;
    watchlistCoins = watchlistCoins.map((savedCoin) => {
        const latestCoin = latestCoins.get(savedCoin.id);
        if (!latestCoin) return savedCoin;
        changed = true;
        return latestCoin;
    });
    if (changed) {
        try {
            localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(watchlistCoins));
        } catch (error) {
            console.error('Unable to update saved market values:', error);
        }
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
    marketTools.hidden = true;
    marketTitle.textContent = 'Your watchlist';
    sectionCaption.textContent = `${watchlistCoins.length} ${watchlistCoins.length === 1 ? 'coin' : 'coins'} saved on this device`;
    if (watchlistCoins.length === 0) {
        showEmptyWatchlist();
        return;
    }
    renderCoins(watchlistCoins, watchlistCoins.length);
}

function renderCurrentView() {
    const isWatchlistView = currentView === 'watchlist';
    marketTitle.textContent = isWatchlistView ? 'Your watchlist' : 'Top cryptocurrencies';
    marketTools.hidden = isWatchlistView;
    if (isWatchlistView) {
        renderWatchlist();
        return;
    }
    applyCoinSearch();
}
// FEATURE 3: Sort current search results by price, 24h change, or market cap.
function applyCoinSearch() {
    if (marketCoins.length === 0) return;
    const query = searchInput.value.trim().toLocaleLowerCase();
    clearSearchButton.hidden = query.length === 0;

    const filteredCoins = query
        ? marketCoins.filter((coin) => {
            const name = (coin.name || '').toLocaleLowerCase();
            const symbol = (coin.symbol || '').toLocaleLowerCase();
            return name.includes(query) || symbol.includes(query);
        })
        : marketCoins;

    if (query && filteredCoins.length === 0) {
        sectionCaption.textContent = `No matching coins in the first ${marketCoins.length} market results`;
        showNoSearchResults(searchInput.value.trim());
        return;
    }

    const sortedCoins = [...filteredCoins].sort((first, second) => {
        const firstValue = Number(first[sortSelect.value]);
        const secondValue = Number(second[sortSelect.value]);
        const safeFirst = Number.isFinite(firstValue) ? firstValue : 0;
        const safeSecond = Number.isFinite(secondValue) ? secondValue : 0;
        return sortDescending ? safeSecond - safeFirst : safeFirst - safeSecond;
    });
    const orderLabel = sortDescending ? 'high to low' : 'low to high';

    if (query) {
        sectionCaption.textContent = `${filteredCoins.length} matching ${filteredCoins.length === 1 ? 'coin' : 'coins'} · sorted by ${SORT_LABELS[sortSelect.value]} (${orderLabel})`;
        renderCoins(sortedCoins, sortedCoins.length);
        return;
    }

    sectionCaption.textContent = sortSelect.value === 'market_cap' && sortDescending
        ? 'The 20 largest coins by market capitalization'
        : `Top 20 coins · sorted by ${SORT_LABELS[sortSelect.value]} (${orderLabel})`;
    renderCoins(sortedCoins);
}
function handleSearchInput() {
    window.clearTimeout(searchDebounceTimer);
    searchDebounceTimer = window.setTimeout(applyCoinSearch, 250);
}
function showEmptyState() {
    const panel = document.createElement('div');
    panel.className = 'state-panel';
    const title = document.createElement('h3');
    title.textContent = 'No coins available';
    const message = document.createElement('p');
    message.textContent = 'CoinGecko returned no market results. Refresh to try again.';
    panel.append(title, message);
    resultsContainer.replaceChildren(panel);
    resultsContainer.setAttribute('aria-busy', 'false');
}

function showErrorState() {
    const panel = document.createElement('div');
    panel.className = 'state-panel state-error';
    const title = document.createElement('h3');
    title.textContent = 'Market data could not load';
    const message = document.createElement('p');
    message.textContent = 'Check your connection and try refreshing the market data.';
    const retry = document.createElement('button');
    retry.className = 'retry-button';
    retry.type = 'button';
    retry.textContent = 'Try again';
    retry.addEventListener('click', loadMarketData);
    panel.append(title, message, retry);
    resultsContainer.replaceChildren(panel);
    resultsContainer.setAttribute('aria-busy', 'false');
}

// Initial data load and user-triggered refresh, with error handling.
async function loadMarketData() {
    refreshButton.disabled = true;
    refreshButton.classList.add('is-refreshing');
    resultsContainer.replaceChildren(createSkeletonRows());
    resultsContainer.setAttribute('aria-busy', 'true');
    updatedLabel.textContent = 'Updating market data…';

    try {
        const response = await fetch(MARKET_API_URL, { headers: { accept: 'application/json' } });
        if (!response.ok) throw new Error(`Market request failed with status ${response.status}`);
        const coins = await response.json();
        if (!Array.isArray(coins) || coins.length === 0) {
            if (currentView === 'watchlist') renderWatchlist();
            else showEmptyState();
            updatedLabel.textContent = 'No market data returned';
            return;
        }
        marketCoins = coins;
        syncSavedCoinData(coins);
        updateWatchlistCount();
        renderCurrentView();
        updatedLabel.textContent = `Updated ${new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date())} · Showing the top ${Math.min(coins.length, DISPLAY_LIMIT)} coins`;
    } catch (error) {
        console.error('Unable to load CoinGecko market data:', error);
        if (currentView === 'watchlist') renderWatchlist();
        else showErrorState();
        updatedLabel.textContent = 'Market data unavailable';
    } finally {
        refreshButton.disabled = false;
        refreshButton.classList.remove('is-refreshing');
    }
}

// Page controls and delegated coin-row actions.
// FEATURE 4: Event delegation handles star clicks for every dynamically rendered coin row.
resultsContainer.addEventListener('click', (event) => {
    const button = event.target.closest('[data-watchlist-toggle]');
    if (!button || !resultsContainer.contains(button)) return;

    const coinId = button.dataset.coinId;
    const coin = marketCoins.find((item) => item.id === coinId)
        || watchlistCoins.find((item) => item.id === coinId);
    if (!coin) return;

    const savedIndex = watchlistCoins.findIndex((savedCoin) => savedCoin.id === coinId);
    if (savedIndex >= 0) watchlistCoins.splice(savedIndex, 1);
    else watchlistCoins.push(coin);

    saveWatchlist();
    renderCurrentView();
});

sidebar.addEventListener('click', (event) => {
    const link = event.target.closest('[data-view]');
    if (!link || !sidebar.contains(link)) return;
    event.preventDefault();
    currentView = link.dataset.view;

    sidebar.querySelectorAll('[data-view]').forEach((viewLink) => {
        const isActive = viewLink.dataset.view === currentView;
        viewLink.classList.toggle('nav-link-active', isActive);
        if (isActive) viewLink.setAttribute('aria-current', 'page');
        else viewLink.removeAttribute('aria-current');
    });
    renderCurrentView();
});
searchInput.addEventListener('input', handleSearchInput);
// FEATURE 3: Re-render the current list when sort controls change.
sortSelect.addEventListener('change', applyCoinSearch);
sortDirectionButton.addEventListener('click', () => {
    sortDescending = !sortDescending;
    const orderLabel = sortDescending ? 'High to low' : 'Low to high';
    sortDirectionIcon.querySelector('i').className = sortDescending
        ? 'fa-solid fa-arrow-down'
        : 'fa-solid fa-arrow-up';
    sortDirectionLabel.textContent = orderLabel;
    sortDirectionButton.setAttribute('aria-label', `Current sort order: ${orderLabel.toLocaleLowerCase()}`);
    applyCoinSearch();
});
clearSearchButton.addEventListener('click', () => {
    searchInput.value = '';
    window.clearTimeout(searchDebounceTimer);
    applyCoinSearch();
    searchInput.focus();
});

updateWatchlistCount();
refreshButton.addEventListener('click', loadMarketData);
loadMarketData();

