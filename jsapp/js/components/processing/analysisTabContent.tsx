import React from 'react';
import singleProcessingStore from 'js/components/processing/singleProcessingStore';

interface AnalysisTabContentState {}

export default class AnalysisTabContent extends React.Component<
  {},
  AnalysisTabContentState
> {
  constructor(props: {}) {
    super(props);

    this.state = {};
  }

  private unlisteners: Function[] = [];

  componentDidMount() {
    this.unlisteners.push(
      singleProcessingStore.listen(this.onSingleProcessingStoreChange, this)
    );
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {
      clb();
    });
  }

  /**
   * Don't want to store a duplicate of store data here just for the sake of
   * comparison, so we need to make the component re-render itself when the
   * store changes :shrug:.
   */
  onSingleProcessingStoreChange() {
    this.forceUpdate();
  }

  /** Identifies what step should be displayed based on the data itself. */
  render() {
    return 'Hello, Analysis!';
  }
}
