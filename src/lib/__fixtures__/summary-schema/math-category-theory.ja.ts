export default `米田の補題（Yoneda lemma）

圏論において、米田の補題は非常に重要な結果の一つである。
局所的に小さな圏 \$\\mathcal{C}\$ と、その対象 \$A\$ を考える。
関手 \$H^A = \\mathrm{Hom}(A, -) : \\mathcal{C} \\to \\mathbf{Set}\$ を表現可能関手と呼ぶ。

米田の補題によれば、任意の関手 \$F: \\mathcal{C} \\to \\mathbf{Set}\$ に対し、自然変換の集合 \$\\mathrm{Nat}(H^A, F)\$ は \$F(A)\$ と自然に同型である：
\$\$ \\mathrm{Nat}(\\mathrm{Hom}(A, -), F) \\cong F(A) \$\$

この同型は、自然変換 \$\\alpha\$ に対し \$\\alpha_A(\\mathrm{id}_A)\$ を対応させる写像によって与えられる。
これにより、圏の対象をその上の関手を通して理解できることが示される。
`;
