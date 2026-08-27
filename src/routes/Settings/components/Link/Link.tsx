import React from 'react';
import classNames from 'classnames';
import { Button } from 'stremio/components';
import Icon from 'stremio/components/Icon';
import styles from './Link.less';

type Props = {
    label: string,
    href?: string,
    target?: string,
    onClick?: () => void,
    chevron?: boolean,
    danger?: boolean,
};

const Link = ({ label, href, target, onClick, chevron, danger }: Props) => {
    return (
        <Button className={classNames(styles['link'], { [styles['row']]: chevron, [styles['danger']]: danger })} title={label} target={target ?? '_blank'} href={href} onClick={onClick}>
            <div className={styles['label']}>{ label }</div>
            {
                chevron ?
                    <Icon className={styles['chevron-icon']} name={'caret-right'} />
                    :
                    null
            }
        </Button>
    );
};

export default Link;
