<?xml version="1.0"?>
<h:html xmlns="http://www.w3.org/2002/xforms" xmlns:h="http://www.w3.org/1999/xhtml" xmlns:ev="http://www.w3.org/2001/xml-events" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:jr="http://openrosa.org/javarosa" xmlns:orx="http://openrosa.org/xforms" xmlns:odk="http://www.opendatakit.org/xforms">
  <h:head>
    <h:title>Project 1 EXAMPLE</h:title>
    <model odk:xforms-version="1.0.0">
      <itext>
        <translation lang="default" default="true()">
          <text id="/akJTPb4JLVFqXMqYhKiPXZ/Question_1:hint">
            <value form="guidance">This is an example</value>
          </text>
        </translation>
      </itext>
      <instance>
        <akJTPb4JLVFqXMqYhKiPXZ id="akJTPb4JLVFqXMqYhKiPXZ">
          <start/>
          <end/>
          <Question_1>Example 1</Question_1>
          <Question_2/>
          <meta>
            <instanceID/>
          </meta>
        </akJTPb4JLVFqXMqYhKiPXZ>
      </instance>
      <bind nodeset="/akJTPb4JLVFqXMqYhKiPXZ/start" jr:preload="timestamp" type="dateTime" jr:preloadParams="start"/>
      <bind nodeset="/akJTPb4JLVFqXMqYhKiPXZ/end" jr:preload="timestamp" type="dateTime" jr:preloadParams="end"/>
      <bind nodeset="/akJTPb4JLVFqXMqYhKiPXZ/Question_1" type="string" required="true()" constraint=". != 'wrong'" jr:constraintMsg="This is not right"/>
      <bind nodeset="/akJTPb4JLVFqXMqYhKiPXZ/Question_2" type="int" required="false()"/>
      <bind nodeset="/akJTPb4JLVFqXMqYhKiPXZ/meta/instanceID" type="string" readonly="true()" jr:preload="uid"/>
    </model>
  </h:head>
  <h:body>
    <input appearance="numbers" ref="/akJTPb4JLVFqXMqYhKiPXZ/Question_1">
      <label>Question 1</label>
      <hint ref="jr:itext('/akJTPb4JLVFqXMqYhKiPXZ/Question_1:hint')"/>
    </input>
    <input ref="/akJTPb4JLVFqXMqYhKiPXZ/Question_2">
      <label>Question 2</label>
    </input>
  </h:body>
</h:html>

