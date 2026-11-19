<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="html"/>
  <xsl:param name="view" select="'suspects'"/>
  <xsl:template match="/case">
    <xsl:choose>
      <xsl:when test="$view='suspects'">
        <div class="board">
          <xsl:for-each select="suspects/suspect">
            <article class="pin"><h3><xsl:value-of select="name"/></h3>
              <p class="role"><xsl:value-of select="role"/></p>
              <p><xsl:value-of select="profile"/></p>
              <p class="motive">Possible motive: <xsl:value-of select="motive"/></p>
            </article>
          </xsl:for-each>
        </div>
      </xsl:when>
      <xsl:otherwise>
        <xsl:variable name="c" select="solution/@culprit"/>
        <xsl:variable name="m" select="solution/@motive"/>
        <h3>The culprit: <xsl:value-of select="suspects/suspect[@id=$c]/name"/></h3>
        <p class="role">Motive: <xsl:value-of select="motives/motive[@id=$m]"/></p>
        <p><xsl:value-of select="solution/explanation"/></p>
        <h4>Key evidence</h4>
        <ul><xsl:for-each select="solution/evidence">
          <xsl:variable name="r" select="@ref"/>
          <li><b><xsl:value-of select="../../clues/clue[@id=$r]/title"/></b>: <xsl:value-of select="../../clues/clue[@id=$r]/text"/></li>
        </xsl:for-each></ul>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>
</xsl:stylesheet>
