import type { ComponentClass } from 'react'
import { ReactTableDefaults } from 'react-table'

interface TablePaginationProps {
  page: number
}

interface TablePaginationState {
  /** Empty while the user has the page input cleared, mid-typing. */
  page: number | ''
}

// `react-table` types its own pagination as a bare element type, so this is as far as the typing goes.
const DefaultPagination = ReactTableDefaults.PaginationComponent as unknown as ComponentClass<
  TablePaginationProps,
  TablePaginationState
>

/**
 * The table footer ("Page _ of 3"), fixing the one thing `react-table` gets wrong about it: it keeps the page number
 * in its own state and only takes a new one from props when that state happens to have changed as well. So a page the
 * table sets by itself - restoring the page a user left on, or dropping to the last page after a record was deleted -
 * never reaches the footer, which goes on showing the page before.
 */
export default class TablePagination extends DefaultPagination {
  componentDidUpdate(prevProps: TablePaginationProps) {
    if (prevProps.page !== this.props.page) {
      this.setState({ page: this.props.page })
    }
  }
}
