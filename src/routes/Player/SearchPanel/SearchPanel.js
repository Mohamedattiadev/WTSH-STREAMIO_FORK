// Copyright (C) 2017-2026 Smart code 203358507

const React = require('react');
const PropTypes = require('prop-types');
const classnames = require('classnames');
const { default: Icon } = require('stremio/components/Icon');
const { Button, MetaItem, TextInput } = require('stremio/components');
const useSearch = require('stremio/routes/Search/useSearch');
const styles = require('./styles');

const SearchPanel = ({ className, closeSearchPanel }) => {
    const [inputValue, setInputValue] = React.useState('');
    const queryParams = React.useMemo(() => {
        const params = new URLSearchParams();
        if (inputValue.trim().length > 0) {
            params.set('search', inputValue.trim());
        }

        return params;
    }, [inputValue]);
    const [search] = useSearch(queryParams);
    const results = React.useMemo(() => {
        return search.catalogs
            .filter((catalog) => catalog.content?.type === 'Ready')
            .flatMap((catalog) => catalog.content.content)
            .slice(0, 24);
    }, [search.catalogs]);
    const onInputChange = React.useCallback((event) => {
        setInputValue(event.currentTarget.value);
    }, []);
    return (
        <div className={classnames(className, styles['search-panel'])}>
            <div className={styles['header']}>
                <Icon className={styles['search-icon']} name={'search'} />
                <TextInput
                    className={styles['input']}
                    value={inputValue}
                    onChange={onInputChange}
                    placeholder={'Search for another title...'}
                    autoFocus={true}
                />
                <Button className={styles['close-button']} title={'Close'} onClick={closeSearchPanel}>
                    <Icon className={styles['icon']} name={'x'} />
                </Button>
            </div>
            <div className={styles['results-container']}>
                {results.map((item) => (
                    <MetaItem
                        key={item.id}
                        type={item.type}
                        name={item.name}
                        poster={item.poster}
                        posterShape={item.posterShape}
                        deepLinks={item.deepLinks}
                    />
                ))}
            </div>
        </div>
    );
};

SearchPanel.propTypes = {
    className: PropTypes.string,
    closeSearchPanel: PropTypes.func
};

module.exports = SearchPanel;
